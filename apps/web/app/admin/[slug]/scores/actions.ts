'use server';

/**
 * Recording a result.
 *
 * Three things have to happen together or not at all: the sets are stored,
 * the match is marked complete with a winner, and the slot that match feeds
 * is filled in. Doing the third one separately is how a bracket ends up
 * with a completed quarter-final and an empty semi-final.
 */

import { revalidatePath } from 'next/cache';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { decide, isOutcome, parseSets, resolveScoringFormat } from '@/lib/match-result';
import { planUndo } from '@/lib/score-history';
import { actorMayScore, resolveScoringActor } from '@/lib/scoring-actor';
import { blocksUpstreamClear, byeAdvanceWinner } from '@/lib/bye-advance';

export interface ScoreState {
  readonly error?: string;
  readonly savedMatchId?: string;
}

/**
 * Fill the slot this match feeds.
 *
 * `matchSides` carries sourceKind + sourceMatchId from draw generation, so
 * advancing is a lookup rather than a recomputation of the bracket. Both
 * directions are handled: `winnerOf` for the main draw, `loserOf` because a
 * third-place playoff is fed by the losing semi-finalists.
 *
 * Returns the ids of matches it touched, so callers can revalidate them.
 */
async function propagate(
  matchId: string,
  winnerEntrantId: string | null,
  loserEntrantId: string | null,
): Promise<void> {
  const downstream = await db()
    .select({
      id: schema.matchSides.id,
      kind: schema.matchSides.sourceKind,
      matchId: schema.matchSides.matchId,
    })
    .from(schema.matchSides)
    .where(eq(schema.matchSides.sourceMatchId, matchId));

  for (const side of downstream) {
    const entrantId =
      side.kind === 'winnerOf' ? winnerEntrantId : side.kind === 'loserOf' ? loserEntrantId : null;
    // A null here is correct when a result is cleared: the slot empties
    // again rather than keeping a stale name.
    if (side.kind !== 'winnerOf' && side.kind !== 'loserOf') continue;
    await db()
      .update(schema.matchSides)
      .set({ entrantId })
      .where(eq(schema.matchSides.id, side.id));

    const targetSides = await db()
      .select({
        entrantId: schema.matchSides.entrantId,
        sourceKind: schema.matchSides.sourceKind,
      })
      .from(schema.matchSides)
      .where(eq(schema.matchSides.matchId, side.matchId));
    const byeWinner = byeAdvanceWinner(targetSides);
    const [targetMatch] = await db()
      .select({
        status: schema.matches.status,
        winnerEntrantId: schema.matches.winnerEntrantId,
      })
      .from(schema.matches)
      .where(eq(schema.matches.id, side.matchId))
      .limit(1);
    if (
      targetMatch === undefined ||
      (targetMatch.status !== 'pending' && targetMatch.status !== 'bye')
    ) {
      continue;
    }

    if (byeWinner !== null) {
      if (targetMatch.status !== 'bye' || targetMatch.winnerEntrantId !== byeWinner) {
        await db()
          .update(schema.matches)
          .set({ status: 'bye', winnerEntrantId: byeWinner, updatedAt: new Date() })
          .where(eq(schema.matches.id, side.matchId));
      }
      await propagate(side.matchId, byeWinner, null);
    } else if (targetMatch.status === 'bye') {
      await db()
        .update(schema.matches)
        .set({ status: 'pending', winnerEntrantId: null, updatedAt: new Date() })
        .where(eq(schema.matches.id, side.matchId));
      await propagate(side.matchId, null, null);
    }
  }
}

async function loadMatch(matchId: string) {
  const rows = await db()
    .select({
      id: schema.matches.id,
      tournamentId: schema.matches.tournamentId,
      eventId: schema.matches.eventId,
      status: schema.matches.status,
      setsToWin: schema.events.setsToWin,
      gamesPerSet: schema.events.gamesPerSet,
      tiebreakAt: schema.events.tiebreakAt,
      tiebreakTo: schema.events.tiebreakTo,
      decidingSetMode: schema.events.decidingSetMode,
      adScoring: schema.events.adScoring,
      // The round may override the draw's format — "the final is best of 3".
      scoringOverride: schema.rounds.scoringOverride,
      slug: schema.tournaments.slug,
    })
    .from(schema.matches)
    .innerJoin(schema.events, eq(schema.events.id, schema.matches.eventId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.matches.tournamentId))
    .leftJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .where(and(eq(schema.matches.id, matchId), eq(schema.matches.organizationId, orgId())))
    .limit(1);
  return rows[0];
}

async function sidesOf(matchId: string) {
  return db()
    .select({
      position: schema.matchSides.position,
      entrantId: schema.matchSides.entrantId,
    })
    .from(schema.matchSides)
    .where(eq(schema.matchSides.matchId, matchId))
    .orderBy(asc(schema.matchSides.position));
}

export async function recordResult(_prev: ScoreState, form: FormData): Promise<ScoreState> {
  /*
   * INF-3: an organizer's session OR a scorekeeper link. The token travels
   * in the form because a server action has no route params of its own.
   */
  const actor = await resolveScoringActor(
    typeof form.get('scorekeeperToken') === 'string' ? String(form.get('scorekeeperToken')) : null,
  );
  if (actor === null) return { error: 'You are not signed in.' };

  const matchId = String(form.get('matchId') ?? '');
  const outcomeRaw = String(form.get('outcome') ?? 'completed');
  if (matchId === '') return { error: 'Missing match.' };
  if (!isOutcome(outcomeRaw)) return { error: 'Unknown outcome.' };

  const match = await loadMatch(matchId);
  if (match === undefined) return { error: 'That match no longer exists.' };
  if (!(await actorMayScore(actor, matchId))) {
    return { error: 'That match is not in this tournament.' };
  }

  const format = resolveScoringFormat(match, match.scoringOverride);
  const parsed = parseSets((name) => {
    const v = form.get(name);
    return typeof v === 'string' ? v : null;
  }, format);
  if (parsed.error !== undefined) return { error: parsed.error };

  const awardedRaw = String(form.get('awardedTo') ?? '');
  const awardedTo = awardedRaw === '0' ? 0 : awardedRaw === '1' ? 1 : null;

  const decided = decide(parsed.sets, format, outcomeRaw, awardedTo);
  if ('error' in decided) return { error: decided.error };

  const sides = await sidesOf(matchId);
  const winnerSide = sides.find((s) => s.position === decided.winner);
  const loserSide = sides.find((s) => s.position !== decided.winner);
  if (winnerSide?.entrantId == null) {
    return { error: 'That side has no entrant yet, so it cannot win the match.' };
  }

  /*
   * Idempotency. The client sends a stable id per attempt, so a retry after
   * a dropped connection courtside records the result once rather than
   * twice. The log is append-only (DB-6), which is also what makes undo
   * possible later.
   */
  const clientEventId = String(form.get('clientEventId') ?? '') || `${matchId}:${Date.now()}`;
  const seen = await db()
    .select({ id: schema.scoreEvents.id })
    .from(schema.scoreEvents)
    .where(eq(schema.scoreEvents.clientEventId, clientEventId))
    .limit(1);
  if (seen.length > 0) return { savedMatchId: matchId };

  // Replace rather than merge: the form always submits the whole score, so
  // an edit that removes a set must remove it here too.
  await db().delete(schema.sets).where(eq(schema.sets.matchId, matchId));
  if (parsed.sets.length > 0) {
    await db()
      .insert(schema.sets)
      .values(
        parsed.sets.map((s) => ({
          matchId,
          setIndex: s.setIndex,
          side0Games: s.side0Games,
          side1Games: s.side1Games,
          side0TiebreakPoints: s.side0TiebreakPoints ?? null,
          side1TiebreakPoints: s.side1TiebreakPoints ?? null,
        })),
      );
  }

  await db()
    .update(schema.matches)
    .set({
      status: 'complete',
      outcome: outcomeRaw,
      winnerEntrantId: winnerSide.entrantId,
      completedAt: new Date(),
    })
    .where(eq(schema.matches.id, matchId));

  await db().insert(schema.scoreEvents).values({
    organizationId: orgId(),
    matchId,
    actorUserId: actor.userId,
    actorLabel: actor.label,
    clientEventId,
    kind: 'result',
    payload: { outcome: outcomeRaw, sets: parsed.sets, winner: decided.winner },
  });

  await propagate(matchId, winnerSide.entrantId, loserSide?.entrantId ?? null);

  revalidatePath(`/admin/${match.slug}/scores`);
  revalidatePath(`/t/${match.slug}`, 'layout');
  return { savedMatchId: matchId };
}

/** Undo a result: empty the match and the slot it had filled downstream. */
/**
 * Downstream matches that already have a result.
 *
 * Emptying a match empties the SLOT it fed, but a result already recorded
 * in that later match survives — so clearing a semifinal left the final
 * standing as won by somebody against an empty line. A bracket that says
 * a player beat nobody is worse than a bracket with a gap in it.
 *
 * The product already takes this position in `redrawEvent`: when a result
 * exists downstream, refuse and say which one, rather than quietly
 * destroying more than was asked for.
 */
async function decidedDownstream(matchId: string): Promise<string[]> {
  const visited = new Set([matchId]);
  let frontier = [matchId];
  const blockers: string[] = [];

  while (frontier.length > 0) {
    const sides = await db()
      .select({ matchId: schema.matchSides.matchId })
      .from(schema.matchSides)
      .where(inArray(schema.matchSides.sourceMatchId, frontier));
    const childIds = [...new Set(sides.map((side) => side.matchId))].filter(
      (id) => !visited.has(id),
    );
    if (childIds.length === 0) break;
    for (const id of childIds) visited.add(id);

    const rows = await db()
      .select({
        round: schema.rounds.name,
        status: schema.matches.status,
        winnerEntrantId: schema.matches.winnerEntrantId,
      })
      .from(schema.matches)
      .leftJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
      .where(inArray(schema.matches.id, childIds));
    for (const row of rows) {
      if (blocksUpstreamClear(row.status, row.winnerEntrantId)) {
        blockers.push(row.round ?? 'a later match');
      }
    }
    frontier = childIds;
  }

  return [...new Set(blockers)];
}

export async function clearResult(_prev: ScoreState, form: FormData): Promise<ScoreState> {
  const actor = await resolveScoringActor(
    typeof form.get('scorekeeperToken') === 'string' ? String(form.get('scorekeeperToken')) : null,
  );
  if (actor === null) return { error: 'You are not signed in.' };
  const matchId = String(form.get('matchId') ?? '');
  if (matchId === '') return { error: 'Missing match.' };

  const match = await loadMatch(matchId);
  if (match === undefined) return { error: 'That match no longer exists.' };
  if (!(await actorMayScore(actor, matchId))) {
    return { error: 'That match is not in this tournament.' };
  }

  const blockers = await decidedDownstream(matchId);
  if (blockers.length > 0) {
    return {
      error: `The ${blockers.join(' and ')} already has a result. Clear that first — otherwise it would stand as won against an empty place in the draw.`,
    };
  }

  await db().delete(schema.sets).where(eq(schema.sets.matchId, matchId));
  await db()
    .update(schema.matches)
    .set({ status: 'pending', outcome: null, winnerEntrantId: null, completedAt: null })
    .where(eq(schema.matches.id, matchId));

  await db().insert(schema.scoreEvents).values({
    organizationId: orgId(),
    matchId,
    actorUserId: actor.userId,
    actorLabel: actor.label,
    clientEventId: `clear:${matchId}:${Date.now()}`,
    kind: 'clear',
    payload: {},
  });

  // Empty the downstream slot too, or the next round keeps a name that no
  // longer won anything.
  await propagate(matchId, null, null);

  revalidatePath(`/admin/${match.slug}/scores`);
  revalidatePath(`/t/${match.slug}`, 'layout');
  return { savedMatchId: matchId };
}

/**
 * SCR-5 — step a match back one event.
 *
 * `clearResult` empties a match; this walks its history. Correcting a
 * mis-keyed third set used to mean destroying the first two and retyping
 * everything, because the only undo available was "delete the lot".
 *
 * The event being taken back is marked with `revertedByEventId` rather than
 * deleted — `score_events` is an append-only audit log (DB-6) and the point
 * of it is to answer "who entered this and when", which a delete would
 * erase. Pressing undo repeatedly therefore walks backwards through the log
 * instead of toggling the same two states.
 */
export async function undoLastEvent(_prev: ScoreState, form: FormData): Promise<ScoreState> {
  const actor = await resolveScoringActor(
    typeof form.get('scorekeeperToken') === 'string' ? String(form.get('scorekeeperToken')) : null,
  );
  if (actor === null) return { error: 'You are not signed in.' };
  const matchId = String(form.get('matchId') ?? '');
  if (matchId === '') return { error: 'Missing match.' };

  const match = await loadMatch(matchId);
  if (match === undefined) return { error: 'That match no longer exists.' };
  if (!(await actorMayScore(actor, matchId))) {
    return { error: 'That match is not in this tournament.' };
  }

  /*
   * Same guard as clearResult. Stepping a match back changes who won it,
   * which would leave a decided later match pointing at the wrong person
   * — or at nobody.
   */
  const blockers = await decidedDownstream(matchId);
  if (blockers.length > 0) {
    return {
      error: `The ${blockers.join(' and ')} already has a result. Clear that first.`,
    };
  }

  const events = await db()
    .select({
      id: schema.scoreEvents.id,
      kind: schema.scoreEvents.kind,
      payload: schema.scoreEvents.payload,
      createdAt: schema.scoreEvents.createdAt,
      revertedByEventId: schema.scoreEvents.revertedByEventId,
    })
    .from(schema.scoreEvents)
    .where(eq(schema.scoreEvents.matchId, matchId));

  const plan = planUndo(events);
  if (plan === null) return { error: 'There is nothing to undo on this match.' };

  const sides = await sidesOf(matchId);

  await db().transaction(async (tx) => {
    // Sets are rewritten wholesale either way: a restored result carries its
    // own full set list, and an undo back to "no result" has none.
    await tx.delete(schema.sets).where(eq(schema.sets.matchId, matchId));

    if (plan.restoreTo === null) {
      await tx
        .update(schema.matches)
        .set({ status: 'pending', outcome: null, winnerEntrantId: null, completedAt: null })
        .where(eq(schema.matches.id, matchId));
    } else {
      const restored = plan.restoreTo;
      if (restored.sets.length > 0) {
        await tx.insert(schema.sets).values(
          restored.sets.map((set) => ({
            matchId,
            setIndex: set.setIndex,
            side0Games: set.side0Games,
            side1Games: set.side1Games,
            side0TiebreakPoints: set.side0TiebreakPoints,
            side1TiebreakPoints: set.side1TiebreakPoints,
          })),
        );
      }
      const winnerSide = sides.find((s) => s.position === restored.winner);
      await tx
        .update(schema.matches)
        .set({
          status: 'complete',
          outcome: restored.outcome as 'completed',
          winnerEntrantId: winnerSide?.entrantId ?? null,
          completedAt: new Date(),
        })
        .where(eq(schema.matches.id, matchId));
    }

    const [undoEvent] = await tx
      .insert(schema.scoreEvents)
      .values({
        organizationId: orgId(),
        matchId,
        actorUserId: actor.userId,
        actorLabel: actor.label,
        clientEventId: `undo:${plan.undoing.id}`,
        kind: 'undo',
        payload: { undidEventId: plan.undoing.id, restored: plan.restoreTo },
      })
      .returning({ id: schema.scoreEvents.id });

    // The column that has existed since DB-6 and never been written.
    if (undoEvent !== undefined) {
      await tx
        .update(schema.scoreEvents)
        .set({ revertedByEventId: undoEvent.id })
        .where(eq(schema.scoreEvents.id, plan.undoing.id));
    }
  });

  // Outside the transaction: propagate reads and writes other matches, and
  // the downstream slot must reflect whatever the match now says.
  const winnerSide =
    plan.restoreTo === null
      ? undefined
      : sides.find((s) => s.position === plan.restoreTo!.winner);
  const loserSide =
    plan.restoreTo === null
      ? undefined
      : sides.find((s) => s.position !== plan.restoreTo!.winner);
  await propagate(matchId, winnerSide?.entrantId ?? null, loserSide?.entrantId ?? null);

  revalidatePath(`/admin/${match.slug}/scores`);
  revalidatePath(`/t/${match.slug}`, 'layout');
  return { savedMatchId: matchId };
}
