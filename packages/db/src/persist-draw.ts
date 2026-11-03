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
}

export interface PersistDrawResult {
  readonly stageId: string;
  readonly groupIds: readonly string[];
  readonly roundIds: readonly string[];
  readonly matchCount: number;
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
      // Everything needed to reproduce this draw, including the random seed.
      config: {
        randomSeed: stage.meta.randomSeed,
        seedingMode: stage.meta.seedingMode,
        bracketSize: stage.meta.bracketSize,
        byeCount: stage.meta.byeCount,
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
          ? (matchIdByEngineId.get(ref.matchId) ?? null)
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
  };
}

/**
 * Active entrants for an event, shaped for the engine.
 *
 * Only `active` is returned: `pending` entrants are unreviewed form
 * submissions and must never appear in a draw.
 */
export async function loadEntrantsForEngine(
  db: Database,
  organizationId: string,
  eventId: string,
): Promise<Array<{ id: string; seed: number | null; status: 'active' }>> {
  const rows = await db
    .select({ id: entrants.id, seed: entrants.seed })
    .from(entrants)
    .where(
      and(
        eq(entrants.organizationId, organizationId),
        eq(entrants.eventId, eventId),
        inArray(entrants.status, ['active']),
      ),
    );

  return rows.map((r) => ({ id: r.id, seed: r.seed, status: 'active' as const }));
}
