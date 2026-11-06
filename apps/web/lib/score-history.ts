/**
 * SCR-5 — reading the score log backwards.
 *
 * `scoreEvents` is append-only and has been since DB-6, but nothing ever
 * read it: the only way to take a score back was `clearResult`, which empties
 * the whole match. So correcting a mis-keyed second set meant destroying the
 * first one too and retyping both, and the `revertedByEventId` column sat
 * unused.
 *
 * Undo here means "step the match back one event", which is possible because
 * every `result` event records the FULL state it produced — outcome, sets and
 * winning side — rather than a diff. Restoring is therefore just replaying
 * the last surviving result, and needs no inverse operation per event type.
 *
 * Pure: rows in, a decision out. The action does the writing.
 */

export interface ResultPayload {
  readonly outcome: string;
  readonly sets: ReadonlyArray<{
    readonly setIndex: number;
    readonly side0Games: number;
    readonly side1Games: number;
    readonly side0TiebreakPoints: number | null;
    readonly side1TiebreakPoints: number | null;
  }>;
  /** Side POSITION, not an entrant id, so it survives anything downstream. */
  readonly winner: 0 | 1;
}

export interface ScoreEventRow {
  readonly id: string;
  readonly kind: string;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly revertedByEventId: string | null;
}

export interface UndoPlan {
  /** The event being taken back. */
  readonly undoing: ScoreEventRow;
  /**
   * The state to put the match into: a result to replay, or null meaning
   * "no result" — pending, no winner, no sets.
   */
  readonly restoreTo: ResultPayload | null;
}

/** A `result` payload, validated — the column is jsonb and could hold anything. */
export function parseResultPayload(value: unknown): ResultPayload | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw['outcome'] !== 'string') return null;
  if (raw['winner'] !== 0 && raw['winner'] !== 1) return null;
  if (!Array.isArray(raw['sets'])) return null;

  const sets: Array<ResultPayload['sets'][number]> = [];
  for (const entry of raw['sets']) {
    if (entry === null || typeof entry !== 'object') return null;
    const s = entry as Record<string, unknown>;
    const num = (key: string): number | null =>
      typeof s[key] === 'number' && Number.isInteger(s[key]) ? (s[key] as number) : null;
    const nullableNum = (key: string): number | null | undefined => {
      if (s[key] === null || s[key] === undefined) return null;
      return typeof s[key] === 'number' && Number.isInteger(s[key]) ? (s[key] as number) : undefined;
    };

    const setIndex = num('setIndex');
    const side0Games = num('side0Games');
    const side1Games = num('side1Games');
    const tb0 = nullableNum('side0TiebreakPoints');
    const tb1 = nullableNum('side1TiebreakPoints');
    if (setIndex === null || side0Games === null || side1Games === null) return null;
    if (tb0 === undefined || tb1 === undefined) return null;

    sets.push({
      setIndex,
      side0Games,
      side1Games,
      side0TiebreakPoints: tb0,
      side1TiebreakPoints: tb1,
    });
  }

  return { outcome: raw['outcome'], sets, winner: raw['winner'] };
}

/** Events that changed the match. `undo` rows are bookkeeping, not states. */
const SUBSTANTIVE = new Set(['result', 'clear']);

/**
 * What undoing one step should do, given a match's whole event log.
 *
 * Only SUBSTANTIVE events — a result or a clear — are candidates to take
 * back. The `undo` rows themselves are audit bookkeeping and are skipped,
 * which is the difference between undo walking backwards through history and
 * undo doing nothing at all: targeting the last undo event would restore the
 * state that same event had just produced, so every press after the first
 * was a silent no-op. Found by pressing it twice.
 *
 * Events already reverted are skipped too, so each press moves one step
 * further back rather than toggling the same pair.
 *
 * The state restored is the last surviving `result` BEFORE the event being
 * undone. A `clear` is not a state — it is the absence of one — so undoing a
 * clear brings back the result that preceded it, and undoing the first
 * result of all leaves the match pending.
 */
export function planUndo(events: readonly ScoreEventRow[]): UndoPlan | null {
  const live = events
    .filter((e) => e.revertedByEventId === null && SUBSTANTIVE.has(e.kind))
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const undoing = live[live.length - 1];
  if (undoing === undefined) return null;

  for (let i = live.length - 2; i >= 0; i -= 1) {
    const candidate = live[i]!;
    if (candidate.kind !== 'result') continue;
    const payload = parseResultPayload(candidate.payload);
    // A result we cannot read is not a state we can restore; keep looking
    // rather than putting the match into a half-remembered one.
    if (payload !== null) return { undoing, restoreTo: payload };
  }

  return { undoing, restoreTo: null };
}

/** Can this match be stepped back at all? Drives whether the button shows. */
export function canUndo(events: readonly ScoreEventRow[]): boolean {
  return events.some((e) => e.revertedByEventId === null && SUBSTANTIVE.has(e.kind));
}
