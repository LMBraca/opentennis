export interface ByeAdvanceSide {
  readonly entrantId: string | null;
  readonly sourceKind: string | null;
}

export interface ByeReconciliationMatch {
  readonly id: string;
  readonly status: string;
  readonly winnerEntrantId: string | null;
}

export interface ByeReconciliationSide extends ByeAdvanceSide {
  readonly id: string;
  readonly matchId: string;
  readonly sourceMatchId: string | null;
}

export interface ByeReconciliation {
  readonly sideUpdates: readonly { readonly id: string; readonly entrantId: string | null }[];
  readonly matchUpdates: readonly {
    readonly id: string;
    readonly status: 'pending' | 'bye';
    readonly winnerEntrantId: string | null;
  }[];
}

export function byeAdvanceWinner(sides: readonly ByeAdvanceSide[]): string | null {
  if (sides.filter((side) => side.sourceKind === 'bye').length !== 1) return null;
  const entrants = sides
    .filter((side) => side.sourceKind !== 'bye')
    .map((side) => side.entrantId)
    .filter((entrantId): entrantId is string => entrantId !== null);
  return entrants.length === 1 ? entrants[0]! : null;
}

export function reconcileByeAdvances(
  matches: readonly ByeReconciliationMatch[],
  sides: readonly ByeReconciliationSide[],
): ByeReconciliation {
  const matchById = new Map(matches.map((match) => [match.id, { ...match }]));
  const originalMatches = new Map(matches.map((match) => [match.id, match]));
  const sidesByMatch = new Map<string, ByeReconciliationSide[]>();
  const sideById = new Map(sides.map((side) => [side.id, { ...side }]));
  for (const side of sideById.values()) {
    sidesByMatch.set(side.matchId, [...(sidesByMatch.get(side.matchId) ?? []), side]);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const match of matchById.values()) {
      if (match.status !== 'pending' && match.status !== 'bye') continue;
      const matchSides = sidesByMatch.get(match.id) ?? [];
      if (matchSides.filter((side) => side.sourceKind === 'bye').length !== 1) continue;

      const fedSide = matchSides.find(
        (side) =>
          (side.sourceKind === 'winnerOf' || side.sourceKind === 'loserOf') &&
          side.sourceMatchId !== null,
      );
      if (fedSide === undefined) continue;

      const source = matchById.get(fedSide.sourceMatchId as string);
      let entrantId: string | null = null;
      if (
        source !== undefined &&
        (source.status === 'complete' || source.status === 'bye') &&
        source.winnerEntrantId !== null
      ) {
        entrantId =
          fedSide.sourceKind === 'winnerOf'
            ? source.winnerEntrantId
            : (sidesByMatch
                .get(source.id)
                ?.find((side) => side.entrantId !== null && side.entrantId !== source.winnerEntrantId)
                ?.entrantId ?? null);
      }

      if (fedSide.entrantId !== entrantId) {
        const updatedSide = { ...fedSide, entrantId };
        sideById.set(fedSide.id, updatedSide);
        sidesByMatch.set(
          match.id,
          matchSides.map((side) => (side.id === fedSide.id ? updatedSide : side)),
        );
        changed = true;
      }

      const winnerEntrantId = byeAdvanceWinner(sidesByMatch.get(match.id) ?? []);
      if (winnerEntrantId !== null) {
        if (match.status !== 'bye' || match.winnerEntrantId !== winnerEntrantId) {
          matchById.set(match.id, { ...match, status: 'bye', winnerEntrantId });
          changed = true;
        }
      } else if (match.status === 'bye') {
        matchById.set(match.id, { ...match, status: 'pending', winnerEntrantId: null });
        changed = true;
      }
    }
  }

  return {
    sideUpdates: [...sideById.values()]
      .filter((side) => side.entrantId !== sides.find((original) => original.id === side.id)?.entrantId)
      .map(({ id, entrantId }) => ({ id, entrantId })),
    matchUpdates: [...matchById.values()]
      .filter((match) => {
        const original = originalMatches.get(match.id);
        return original !== undefined &&
          (match.status !== original.status || match.winnerEntrantId !== original.winnerEntrantId);
      })
      .map(({ id, status, winnerEntrantId }) => ({
        id,
        status: status === 'bye' ? 'bye' : 'pending',
        winnerEntrantId,
      })),
  };
}

export function blocksUpstreamClear(status: string, winnerEntrantId: string | null): boolean {
  return status !== 'bye' && winnerEntrantId !== null;
}
