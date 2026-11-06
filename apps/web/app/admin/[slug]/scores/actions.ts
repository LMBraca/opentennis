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
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { decide, isOutcome, parseSets, scoringFormatFor } from '@/lib/match-result';

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
    .select({ id: schema.matchSides.id, kind: schema.matchSides.sourceKind })
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
      slug: schema.tournaments.slug,
    })
    .from(schema.matches)
    .innerJoin(schema.events, eq(schema.events.id, schema.matches.eventId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.matches.tournamentId))
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
  const user = await requireUser('/admin');

  const matchId = String(form.get('matchId') ?? '');
  const outcomeRaw = String(form.get('outcome') ?? 'completed');
  if (matchId === '') return { error: 'Missing match.' };
  if (!isOutcome(outcomeRaw)) return { error: 'Unknown outcome.' };

  const match = await loadMatch(matchId);
  if (match === undefined) return { error: 'That match no longer exists.' };

  const format = scoringFormatFor(match);
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
    actorUserId: user.id,
    actorLabel: user.email,
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
export async function clearResult(form: FormData): Promise<void> {
  const user = await requireUser('/admin');
  const matchId = String(form.get('matchId') ?? '');
  if (matchId === '') return;

  const match = await loadMatch(matchId);
  if (match === undefined) return;

  await db().delete(schema.sets).where(eq(schema.sets.matchId, matchId));
  await db()
    .update(schema.matches)
    .set({ status: 'pending', outcome: null, winnerEntrantId: null, completedAt: null })
    .where(eq(schema.matches.id, matchId));

  await db().insert(schema.scoreEvents).values({
    organizationId: orgId(),
    matchId,
    actorUserId: user.id,
    actorLabel: user.email,
    clientEventId: `clear:${matchId}:${Date.now()}`,
    kind: 'clear',
    payload: {},
  });

  // Empty the downstream slot too, or the next round keeps a name that no
  // longer won anything.
  await propagate(matchId, null, null);

  revalidatePath(`/admin/${match.slug}/scores`);
  revalidatePath(`/t/${match.slug}`, 'layout');
}
