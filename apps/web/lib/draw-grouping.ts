/**
 * RV-18 — matches arranged the way the bracket reads.
 *
 * In `lib` rather than inline in the component for the same reason
 * `upload-policy.ts` is: the admin screens are behind a session, so the
 * rendered output cannot be exercised from a test runner or a curl. Logic
 * I cannot reach through the UI gets asserted directly or it gets shipped
 * unverified.
 */

export interface Placed {
  readonly drawLabel: string;
  readonly roundIndex: number;
  readonly slotIndex: number;
}

export interface DrawColumn<T> {
  readonly roundIndex: number;
  readonly matches: readonly T[];
}

export interface GroupedDraw<T> {
  readonly label: string;
  readonly columns: readonly DrawColumn<T>[];
}

/**
 * Group by draw, then by round, each in bracket order.
 *
 * Draw order follows first appearance rather than being sorted by label:
 * the caller hands these over already sorted by the ladder, and
 * re-sorting alphabetically here would put C+ above Open.
 */
export function groupIntoDraws<T extends Placed>(matches: readonly T[]): GroupedDraw<T>[] {
  const byDraw = new Map<string, Map<number, T[]>>();

  for (const match of matches) {
    const rounds = byDraw.get(match.drawLabel) ?? new Map<number, T[]>();
    const column = rounds.get(match.roundIndex) ?? [];
    column.push(match);
    rounds.set(match.roundIndex, column);
    byDraw.set(match.drawLabel, rounds);
  }

  return [...byDraw.entries()].map(([label, rounds]) => ({
    label,
    columns: [...rounds.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([roundIndex, column]) => ({
        roundIndex,
        matches: [...column].sort((a, b) => a.slotIndex - b.slotIndex),
      })),
  }));
}
