import type { SchedulableMatch } from '@opentennis/engine';

export interface SchedulingMatchRow {
  readonly id: string;
  readonly eventId: string;
  readonly roundIndex: number;
  readonly status: string;
  readonly groupId: string | null;
}

export interface SchedulingSideRow {
  readonly matchId: string;
  readonly entrantId: string | null;
  readonly sourceKind: string | null;
  readonly sourceMatchId: string | null;
  readonly sourceGroupId: string | null;
}

export function adaptSchedulingMatches(
  rows: readonly SchedulingMatchRow[],
  sides: readonly SchedulingSideRow[],
): SchedulableMatch[] {
  const sidesByMatch = new Map<string, SchedulingSideRow[]>();
  const knownByMatch = new Map<string, string[]>();
  for (const side of sides) {
    sidesByMatch.set(side.matchId, [...(sidesByMatch.get(side.matchId) ?? []), side]);
    if (side.entrantId !== null) {
      knownByMatch.set(side.matchId, [...(knownByMatch.get(side.matchId) ?? []), side.entrantId]);
    }
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const byeIds = new Set(
    rows
      .filter(
        (row) =>
          row.status === 'bye' ||
          sidesByMatch.get(row.id)?.some((side) => side.sourceKind === 'bye') === true,
      )
      .map((row) => row.id),
  );
  const groupMatches = new Map<string, string[]>();
  for (const row of rows) {
    if (row.groupId === null) continue;
    groupMatches.set(row.groupId, [...(groupMatches.get(row.groupId) ?? []), row.id]);
  }
  const directDeps = new Map(
    rows.map((row) => {
      const dependencies = (sidesByMatch.get(row.id) ?? []).flatMap((side) => {
        if (
          (side.sourceKind === 'winnerOf' || side.sourceKind === 'loserOf') &&
          side.sourceMatchId !== null
        ) {
          return [side.sourceMatchId];
        }
        if (side.sourceKind === 'groupRank' && side.sourceGroupId !== null) {
          return groupMatches.get(side.sourceGroupId) ?? [];
        }
        return [];
      });
      return [row.id, [...new Set(dependencies)]];
    }),
  );

  const expandDependencies = (matchId: string): string[] => {
    const expanded = new Set<string>();
    const visit = (dependencyId: string, visited: Set<string>): void => {
      if (visited.has(dependencyId) || !rowById.has(dependencyId)) return;
      if (!byeIds.has(dependencyId)) {
        expanded.add(dependencyId);
        return;
      }

      const nextVisited = new Set(visited).add(dependencyId);
      for (const predecessor of directDeps.get(dependencyId) ?? []) {
        visit(predecessor, nextVisited);
      }
    };

    for (const dependencyId of directDeps.get(matchId) ?? []) {
      visit(dependencyId, new Set([matchId]));
    }
    return [...expanded];
  };

  const roundsInEvent = new Map<string, number>();
  const eventEntrants = new Map<string, Set<string>>();
  for (const row of rows) {
    roundsInEvent.set(
      row.eventId,
      Math.max(roundsInEvent.get(row.eventId) ?? 0, row.roundIndex + 1),
    );
    const entrants = eventEntrants.get(row.eventId) ?? new Set<string>();
    for (const entrantId of knownByMatch.get(row.id) ?? []) entrants.add(entrantId);
    eventEntrants.set(row.eventId, entrants);
  }

  return rows.map((row) => {
    const dependencies = expandDependencies(row.id);
    const known = knownByMatch.get(row.id) ?? [];
    const hasUnresolvedFeed = (directDeps.get(row.id) ?? []).length > 0;
    return {
      id: row.id,
      eventId: row.eventId,
      roundIndex: row.roundIndex,
      roundsInEvent: roundsInEvent.get(row.eventId) ?? 1,
      isBye: byeIds.has(row.id),
      potentialEntrantIds:
        known.length === 0 || hasUnresolvedFeed
          ? [...(eventEntrants.get(row.eventId) ?? [])]
          : known,
      dependsOn: dependencies,
    };
  });
}
