/**
 * Persist an engine-generated stage into Postgres.
 *
 * This is the seam between the two halves of the product: the engine is pure
 * and knows nothing about storage, the schema knows nothing about tournament
 * rules, and this module is the only place that translates between them.
 *
 * Two translations matter:
 *
 *   - The engine's match ids are deterministic strings ("r0m3", "g1r0m0").
 *     They are stored as `engineMatchId` and NOT used as primary keys, so a
 *     redraw can replace rows without colliding. sourceRefs are resolved
 *     through those engine ids into real row ids.
 *
 *   - The engine emits a flat list of rounds; the schema nests them under a
 *     stage. Group-stage rounds from several pools share a round index, which
 *     is why `rounds` has no unique constraint on (stageId, roundIndex).
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { GeneratedStage, MatchSide } from '@opentennis/engine';
import type { Database } from './client';
import { groupEntrants, groups, matchSides, matches, rounds, stages } from './schema/draws';
import { entrants, events } from './schema/core';

export interface PersistDrawInput {
  readonly db: Database;
  readonly organizationId: string;
  readonly tournamentId: string;
  readonly eventId: string;
  readonly stage: GeneratedStage;
  /** Maps engine entrant ids to database entrant row ids. */
  readonly entrantIdMap: ReadonlyMap<string, string>;
  readonly sortOrder?: number;
  readonly stageName?: string;
  /**
   * The consolation stage points at the main draw it hangs off.
   *
   * `stages.parentStageId` has existed since v1 for exactly this
   * (docs/consolation-draws-deferred.md §4, guardrail 2).
   */
  readonly parentStageId?: string;
  /**
   * Engine match id -> row id from a stage persisted EARLIER in this draw.
   *
   * Needed because a consolation bracket's first round is fed by
   * `loserOf` refs into the MAIN stage, and each call only knows about the
   * matches it inserted itself. Without this every one of those refs
   * resolves to null and nobody is ever fed into the second bracket.
   */
  readonly externalMatchIds?: ReadonlyMap<string, string>;
}

export interface PersistDrawResult {
  readonly stageId: string;
  readonly groupIds: readonly string[];
  readonly roundIds: readonly string[];
  readonly matchCount: number;
  /** Pass into a dependent stage's `externalMatchIds`. */
  readonly matchIdByEngineId: ReadonlyMap<string, string>;
}

/**
 * Wipe any previously generated structure for an event.
 *
 * Regeneration is allowed while an event is in draft, and a stale half-draw is
 * worse than none. Cascades handle rounds, matches, sides, and group members.
 */
export async function clearDraw(
  db: Database,
  organizationId: string,
  eventId: string,
): Promise<void> {
  await db
    .delete(stages)
    .where(and(eq(stages.organizationId, organizationId), eq(stages.eventId, eventId)));
}

export async function persistDraw(input: PersistDrawInput): Promise<PersistDrawResult> {
  const { db, organizationId, tournamentId, eventId, stage, entrantIdMap } = input;

  const resolveEntrant = (engineId: string | null): string | null => {
    if (engineId === null) return null;
    const dbId = entrantIdMap.get(engineId);
    if (dbId === undefined) {
      // Loud rather than silently dropping someone out of a draw.
      throw new Error(`Engine entrant "${engineId}" has no database row`);
    }
    return dbId;
  };

  const [stageRow] = await db
    .insert(stages)
    .values({
      organizationId,
      eventId,
      kind: stage.kind,
      sortOrder: input.sortOrder ?? 0,
      name: input.stageName ?? null,
      ...(input.parentStageId !== undefined ? { parentStageId: input.parentStageId } : {}),
      // Everything needed to reproduce this draw, including the random seed.
      //
      // `description` is the engine's English sentence. The counts beside it
      // are what the site rebuilds that sentence FROM, in whichever language
      // the reader is in — the stored string is the fallback for stages
      // persisted before those counts were kept.
      config: {
        randomSeed: stage.meta.randomSeed,
        seedingMode: stage.meta.seedingMode,
        bracketSize: stage.meta.bracketSize,
        byeCount: stage.meta.byeCount,
        entrantCount: stage.meta.entrantCount,
        seededCount: stage.meta.seededCount,
        description: stage.meta.description,
      },
    })
    .returning({ id: stages.id });

  if (stageRow === undefined) throw new Error('Failed to insert stage');
  const stageId = stageRow.id;

  // Groups, keyed by the engine's group id so rounds can find them.
  const groupIdByEngineId = new Map<string, string>();
  for (const [index, group] of stage.groups.entries()) {
    const [row] = await db
      .insert(groups)
      .values({ organizationId, stageId, name: group.name, sortOrder: index })
      .returning({ id: groups.id });
    if (row === undefined) throw new Error(`Failed to insert group ${group.name}`);
    groupIdByEngineId.set(group.id, row.id);

    const members = group.entrantIds
      .map((engineId) => resolveEntrant(engineId))
      .filter((id): id is string => id !== null)
      .map((entrantId) => ({ groupId: row.id, entrantId }));
    if (members.length > 0) await db.insert(groupEntrants).values(members);
  }

  // Rounds and matches. Matches are inserted first across every round so that
  // sourceRefs -- which point forwards and backwards -- can all be resolved in
  // a second pass.
  const roundIds: string[] = [];
  const matchIdByEngineId = new Map<string, string>();
  const pendingSides: Array<{ matchId: string; side: MatchSide }> = [];

  for (const round of stage.rounds) {
    const groupId = round.groupId === undefined ? null : (groupIdByEngineId.get(round.groupId) ?? null);

    const [roundRow] = await db
      .insert(rounds)
      .values({
        organizationId,
        stageId,
        groupId,
        roundIndex: round.index,
        name: round.name,
        kind: round.kind,
        idleEntrantIds:
          round.idleEntrantIds === undefined
            ? null
            : round.idleEntrantIds.map((id) => resolveEntrant(id)),
      })
      .returning({ id: rounds.id });
    if (roundRow === undefined) throw new Error(`Failed to insert round ${round.name}`);
    roundIds.push(roundRow.id);

    for (const match of round.matches) {
      const [matchRow] = await db
        .insert(matches)
        .values({
          organizationId,
          tournamentId,
          eventId,
          roundId: roundRow.id,
          groupId,
          engineMatchId: match.id,
          slotIndex: match.slotIndex,
          status: match.status === 'bye' ? 'bye' : 'pending',
        })
        .returning({ id: matches.id });
      if (matchRow === undefined) throw new Error(`Failed to insert match ${match.id}`);

      matchIdByEngineId.set(match.id, matchRow.id);
      for (const side of match.sides) pendingSides.push({ matchId: matchRow.id, side });
    }
  }

  // Second pass: sides, now that every match has a row id to point at.
  const sideRows = pendingSides.map(({ matchId, side }) => {
    const ref = side.sourceRef;
    return {
      matchId,
      position: side.position,
      entrantId: resolveEntrant(side.entrantId),
      sourceKind: ref?.kind ?? null,
      sourceMatchId:
        ref?.kind === 'winnerOf' || ref?.kind === 'loserOf'
          ? // This stage first, then a stage persisted before it — that
            // second lookup is what lets a consolation bracket point back
            // at the main draw's matches.
            (matchIdByEngineId.get(ref.matchId) ??
              input.externalMatchIds?.get(ref.matchId) ??
              null)
          : null,
      sourceGroupId: ref?.kind === 'groupRank' ? (groupIdByEngineId.get(ref.groupId) ?? null) : null,
      sourceRank: ref?.kind === 'groupRank' ? ref.rank : null,
    };
  });

  if (sideRows.length > 0) await db.insert(matchSides).values(sideRows);

  await db
    .update(events)
    .set({ drawRandomSeed: stage.meta.randomSeed, status: 'published', updatedAt: new Date() })
    .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)));

  return {
    stageId,
    groupIds: [...groupIdByEngineId.values()],
    roundIds,
    matchCount: matchIdByEngineId.size,
    matchIdByEngineId,
  };
}

/**
 * Active entrants for an event, shaped for the engine.
 *
 * Only `active` is returned: `pending` entrants are unreviewed form
 * submissions and must never appear in a draw.
 */
/**
 * Who actually goes into the draw.
 *
 * Active, and — when the event charges — PAID. That second condition
 * replaced the review-entries toggle: a club that wanted entries held
 * back was never really asking to approve people, it was asking not to
 * draw someone who had not paid yet. Approval is an admin chore; money
 * is the real gate, and it is one the organizer already tracks with the
 * paid tick.
 *
 * A free event has no gate at all — `entryFeeCents` null or zero means
 * everyone active is in, which is how most categories run.
 */
export async function loadEntrantsForEngine(
  db: Database,
  organizationId: string,
  eventId: string,
): Promise<Array<{ id: string; seed: number | null; status: 'active' }>> {
  const [event] = await db
    .select({ feeCents: events.entryFeeCents })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  const chargesEntry = (event?.feeCents ?? 0) > 0;

  const rows = await db
    .select({ id: entrants.id, seed: entrants.seed })
    .from(entrants)
    .where(
      and(
        eq(entrants.organizationId, organizationId),
        eq(entrants.eventId, eventId),
        inArray(entrants.status, ['active']),
        ...(chargesEntry ? [eq(entrants.paid, true)] : []),
      ),
    );

  return rows.map((r) => ({ id: r.id, seed: r.seed, status: 'active' as const }));
}
