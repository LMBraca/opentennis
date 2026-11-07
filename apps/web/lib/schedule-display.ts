export interface ScheduleDisplayMatch {
  readonly id: string;
  readonly eventId: string;
  readonly groupId: string | null;
  readonly status: string;
  readonly winnerEntrantId: string | null;
  readonly scheduledAt: Date | null;
  readonly completedAt: Date | null;
  readonly courtName: string | null;
}

export interface ScheduleDisplaySide {
  readonly id: string;
  readonly matchId: string;
  readonly position: number;
  readonly entrantId: string | null;
  readonly sourceKind: string | null;
  readonly sourceMatchId: string | null;
  readonly sourceGroupId: string | null;
}

export interface ScheduleDisplayConfig {
  readonly matchMinutes: number;
  readonly minRestMinutes: number;
}

export interface ScheduleDisplay {
  readonly matches: ReadonlyMap<string, ScheduleDisplayMatch>;
  readonly sides: readonly ScheduleDisplaySide[];
}

function loserOf(
  sides: readonly ScheduleDisplaySide[],
  winnerEntrantId: string,
): string | null {
  return (
    sides.find((side) => side.entrantId !== null && side.entrantId !== winnerEntrantId)?.entrantId ??
    null
  );
}

export function reconcileScheduleDisplay(
  inputMatches: readonly ScheduleDisplayMatch[],
  inputSides: readonly ScheduleDisplaySide[],
  configByEvent: ReadonlyMap<string, ScheduleDisplayConfig>,
): ScheduleDisplay {
  const matches = new Map(inputMatches.map((match) => [match.id, { ...match }]));
  const sides = new Map(inputSides.map((side) => [side.id, { ...side }]));
  const sidesByMatch = new Map<string, ScheduleDisplaySide[]>();
  const groupMatches = new Map<string, string[]>();
  const downstreamSidesBySource = new Map<string, ScheduleDisplaySide[]>();

  for (const match of matches.values()) {
    if (match.groupId !== null) {
      groupMatches.set(match.groupId, [...(groupMatches.get(match.groupId) ?? []), match.id]);
    }
  }
  for (const side of sides.values()) {
    if (side.sourceMatchId === null) continue;
    downstreamSidesBySource.set(side.sourceMatchId, [
      ...(downstreamSidesBySource.get(side.sourceMatchId) ?? []),
      side,
    ]);
  }
  const indexSides = (): void => {
    sidesByMatch.clear();
    for (const side of sides.values()) {
      sidesByMatch.set(side.matchId, [...(sidesByMatch.get(side.matchId) ?? []), side]);
    }
  };
  indexSides();

  const automaticByes = new Set<string>();
  for (const match of matches.values()) {
    if (match.status === 'bye') automaticByes.add(match.id);
  }
  let changed = true;
  for (let pass = 0; changed && pass <= matches.size; pass += 1) {
    changed = false;
    for (const match of matches.values()) {
      const currentSides = sidesByMatch.get(match.id) ?? [];
      if (match.status !== 'complete' && match.status !== 'live') {
        const byeSides = currentSides.filter((side) => side.sourceKind === 'bye');
        const playableSides = currentSides.filter((side) => side.sourceKind !== 'bye');
        if (byeSides.length === 1 && playableSides.length === 1) {
          const winner = playableSides[0]?.entrantId ?? null;
          if (winner !== null) {
            automaticByes.add(match.id);
            if (match.status !== 'bye' || match.winnerEntrantId !== winner) {
              matches.set(match.id, { ...match, status: 'bye', winnerEntrantId: winner });
              changed = true;
            }
          }
        }
      }

      if (
        (match.status === 'complete' || match.status === 'bye') &&
        match.winnerEntrantId !== null
      ) {
        const loser = loserOf(currentSides, match.winnerEntrantId);
        for (const side of downstreamSidesBySource.get(match.id) ?? []) {
          if (side.sourceKind !== 'winnerOf' && side.sourceKind !== 'loserOf') continue;
          const entrantId = side.sourceKind === 'winnerOf' ? match.winnerEntrantId : loser;
          const target = matches.get(side.matchId);
          const currentSide = sides.get(side.id);
          if (
            target === undefined ||
            target.status === 'complete' ||
            target.status === 'live' ||
            currentSide?.entrantId === entrantId
          ) {
            continue;
          }
          sides.set(side.id, { ...side, entrantId });
          changed = true;
        }
      }
    }
    if (changed) indexSides();
  }

  const noCourtMatches = new Set(automaticByes);
  for (const match of matches.values()) {
    const byeSides = (sidesByMatch.get(match.id) ?? []).filter((side) => side.sourceKind === 'bye');
    if (byeSides.length === 1) noCourtMatches.add(match.id);
    if (match.status === 'bye') noCourtMatches.add(match.id);
  }
  for (const id of noCourtMatches) {
    const match = matches.get(id);
    if (match !== undefined) {
      matches.set(id, { ...match, scheduledAt: null, courtName: null });
    }
  }

  const directDependencies = (matchId: string): string[] => {
    const dependencies = new Set<string>();
    for (const side of sidesByMatch.get(matchId) ?? []) {
      if (
        (side.sourceKind === 'winnerOf' || side.sourceKind === 'loserOf') &&
        side.sourceMatchId !== null
      ) {
        dependencies.add(side.sourceMatchId);
      } else if (side.sourceKind === 'groupRank' && side.sourceGroupId !== null) {
        for (const groupMatchId of groupMatches.get(side.sourceGroupId) ?? []) {
          dependencies.add(groupMatchId);
        }
      }
    }
    return [...dependencies];
  };
  const expandedDependencies = (matchId: string): Set<string> => {
    const dependencies = new Set<string>();
    const visit = (dependencyId: string, visited: Set<string>): void => {
      if (visited.has(dependencyId) || !matches.has(dependencyId)) return;
      if (!noCourtMatches.has(dependencyId)) {
        dependencies.add(dependencyId);
        return;
      }
      const nextVisited = new Set(visited).add(dependencyId);
      for (const predecessor of directDependencies(dependencyId)) {
        visit(predecessor, nextVisited);
      }
    };
    for (const dependencyId of directDependencies(matchId)) {
      visit(dependencyId, new Set([matchId]));
    }
    return dependencies;
  };

  for (const match of matches.values()) {
    if (noCourtMatches.has(match.id) || match.status === 'bye') continue;
    const config = configByEvent.get(match.eventId);
    if (config === undefined || match.scheduledAt === null) continue;

    let earliest = Number.NEGATIVE_INFINITY;
    let blocked = false;
    for (const dependencyId of expandedDependencies(match.id)) {
      const feeder = matches.get(dependencyId);
      if (feeder === undefined) continue;
      const finish =
        feeder.status === 'complete'
          ? Math.max(
              feeder.completedAt?.getTime() ?? Number.NEGATIVE_INFINITY,
              feeder.scheduledAt === null
                ? Number.NEGATIVE_INFINITY
                : feeder.scheduledAt.getTime() + config.matchMinutes * 60_000,
            )
          : feeder.scheduledAt?.getTime() === undefined
            ? Number.NaN
            : feeder.scheduledAt.getTime() + config.matchMinutes * 60_000;
      if (!Number.isFinite(finish)) {
        blocked = true;
        break;
      }
      earliest = Math.max(earliest, finish + config.minRestMinutes * 60_000);
    }

    if (blocked || match.scheduledAt.getTime() < earliest) {
      matches.set(match.id, { ...match, scheduledAt: null, courtName: null });
    }
  }

  return {
    matches,
    sides: [...sides.values()],
  };
}
