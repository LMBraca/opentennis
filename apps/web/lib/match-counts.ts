export interface CountableMatch {
  readonly status: string;
  readonly scheduledAt?: Date | string | null | undefined;
  readonly winnerEntrantId?: string | null | undefined;
  readonly sides?: readonly {
    readonly entrantId: string | null;
    readonly source?: { readonly kind: string } | null | undefined;
  }[] | undefined;
}

export interface MatchCounts {
  readonly total: number;
  readonly scheduled: number;
  readonly ready: number;
  readonly waiting: number;
  readonly completed: number;
}

export function matchCounts(matches: readonly CountableMatch[]): MatchCounts {
  const playable = matches.filter(
    (match) =>
      match.status !== 'bye' &&
      !(match.sides ?? []).some((side) => side.source?.kind === 'bye'),
  );
  const completed = playable.filter(
    (match) => match.status === 'complete' || match.winnerEntrantId != null,
  );
  const pending = playable.filter(
    (match) => match.status !== 'complete' && match.winnerEntrantId == null,
  );

  const ready = pending.filter((match) => {
    const sides = match.sides ?? [];
    return sides.length > 0 && sides.every((side) => side.entrantId !== null);
  });
  const waiting = pending.filter((match) => {
    const sides = match.sides ?? [];
    return sides.length === 0 || sides.some((side) => side.entrantId === null);
  });

  return {
    total: playable.length,
    scheduled: playable.filter((match) => match.scheduledAt != null).length,
    ready: ready.length,
    waiting: waiting.length,
    completed: completed.length,
  };
}
