/**
 * OT-8 — what "matches" means, once, for the whole product.
 *
 * The manage page said a tournament had 57 matches and 3 of 57 played,
 * while its schedule, results and order of play all said 35. Both were
 * counting correctly; they were counting different things. `eventCounts`
 * took every row in `matches`, and a bye is a row in `matches` — so the
 * number an organizer saw first, on the page they run the tournament
 * from, was the only one that included 22 matches nobody plays.
 *
 * The public side had the mirror of it: a "Consolación" header showing
 * the MAIN draw's count, so an 8-player consolation announced 7 partidos.
 *
 * Six named scopes, one definition each. A surface picks the scope it
 * means and labels it; it does not get to invent a seventh.
 *
 * Pure: rows in, numbers out. The rows can come from a query, a test, or
 * the engine.
 */

/** The minimum a row needs for any of this to be decidable. */
export interface CountableMatch {
  /** As stored: 'pending' | 'live' | 'complete' | 'bye'. */
  readonly status: string;
  readonly winnerEntrantId: string | null;
  readonly scheduledAt: Date | null;
  /** The stage this match belongs to: 'consolation' or anything else. */
  readonly stageKind: string;
  /** Whether BOTH sides have an entrant. */
  readonly bothSidesNamed: boolean;
}

export interface MatchScopes {
  /**
   * Every match that can produce a result. Byes excluded — this is the
   * number that goes next to the word "Partidos".
   */
  readonly total: number;
  /** Playable matches in the main draw. */
  readonly main: number;
  /** Playable matches in a consolation stage. */
  readonly consolation: number;
  /** Playable matches with a start time. */
  readonly scheduled: number;
  /** Both sides named, no result yet — somebody can play this now. */
  readonly ready: number;
  /** No result and at least one side unknown — waiting on an earlier match. */
  readonly waiting: number;
  /** Has a recorded result. */
  readonly completed: number;
  /**
   * Byes, counted so a surface can MENTION them, never so it can add
   * them to anything. Reported separately because "35 partidos" plus a
   * footnote is honest and "57 partidos" is not.
   */
  readonly byes: number;
}

/** A bye is not a match anybody plays. This is the one rule everything else rests on. */
export function isPlayable(match: CountableMatch): boolean {
  return match.status !== 'bye';
}

function isCompleted(match: CountableMatch): boolean {
  /*
   * Both conditions, because the two can disagree and have: `clearResult`
   * sets status back to 'pending' and nulls the winner, but a half-applied
   * write — the propagation that runs outside that transaction — could
   * leave one without the other. Requiring both means a match in that
   * state counts as unfinished, which is the safer direction: it shows up
   * as work to do rather than silently vanishing from the total.
   */
  return match.status === 'complete' && match.winnerEntrantId !== null;
}

export function matchScopes(matches: readonly CountableMatch[]): MatchScopes {
  const playable = matches.filter(isPlayable);

  const completed = playable.filter(isCompleted);
  const unfinished = playable.filter((m) => !isCompleted(m));
  const ready = unfinished.filter((m) => m.bothSidesNamed);

  return {
    total: playable.length,
    main: playable.filter((m) => m.stageKind !== 'consolation').length,
    consolation: playable.filter((m) => m.stageKind === 'consolation').length,
    scheduled: playable.filter((m) => m.scheduledAt !== null).length,
    ready: ready.length,
    waiting: unfinished.length - ready.length,
    completed: completed.length,
    byes: matches.length - playable.length,
  };
}

/**
 * The invariant every surface depends on: ready + waiting + completed is
 * the total. Exported so a test can assert it rather than restate it, and
 * so a caller building a progress bar can check its own arithmetic.
 *
 * If this is ever false, a match is being counted twice or not at all.
 */
export function scopesAreConsistent(scopes: MatchScopes): boolean {
  return (
    scopes.ready + scopes.waiting + scopes.completed === scopes.total &&
    scopes.main + scopes.consolation === scopes.total
  );
}
