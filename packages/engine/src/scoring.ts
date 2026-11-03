/**
 * Scoring formats and set validation.
 *
 * Spec: docs/tournament-formats.md §5.
 *
 * The admin score-entry UI derives its allowed states from these predicates
 * rather than duplicating the rules, which is what makes invalid scores
 * unreachable in the interface instead of rejected after submission.
 */

import { engineError } from './errors';
import type { ScoringFormat, SetScore } from './types';

/* ------------------------------------------------------------------------- */
/* Presets                                                                    */
/* ------------------------------------------------------------------------- */

export const BEST_OF_3: ScoringFormat = {
  setsToWin: 2,
  gamesPerSet: 6,
  tiebreakAt: 6,
  tiebreakTo: 7,
  decidingSetMode: 'standard',
  adScoring: true,
};

/** Best of 3 with a 10-point match tiebreak instead of a third set. */
export const BEST_OF_3_MATCH_TIEBREAK: ScoringFormat = {
  ...BEST_OF_3,
  decidingSetMode: 'matchTiebreak',
};

export const BEST_OF_5: ScoringFormat = { ...BEST_OF_3, setsToWin: 3 };

export const PRO_SET_8: ScoringFormat = {
  setsToWin: 1,
  gamesPerSet: 8,
  tiebreakAt: 8,
  tiebreakTo: 7,
  decidingSetMode: 'standard',
  adScoring: true,
};

export const SINGLE_SET_6: ScoringFormat = {
  setsToWin: 1,
  gamesPerSet: 6,
  tiebreakAt: 6,
  tiebreakTo: 7,
  decidingSetMode: 'standard',
  adScoring: true,
};

/** Games to 4, tiebreak at 3-3 to 5 points, no-ad. */
export const FAST4: ScoringFormat = {
  setsToWin: 2,
  gamesPerSet: 4,
  tiebreakAt: 3,
  tiebreakTo: 5,
  decidingSetMode: 'standard',
  adScoring: false,
};

/** Advantage sets — no tiebreak, win by two with no upper bound. */
export const ADVANTAGE_BEST_OF_3: ScoringFormat = {
  setsToWin: 2,
  gamesPerSet: 6,
  tiebreakAt: null,
  tiebreakTo: 7,
  decidingSetMode: 'standard',
  adScoring: true,
};

export const SCORING_PRESETS = {
  bestOf3: BEST_OF_3,
  bestOf3MatchTiebreak: BEST_OF_3_MATCH_TIEBREAK,
  bestOf5: BEST_OF_5,
  proSet8: PRO_SET_8,
  singleSet6: SINGLE_SET_6,
  fast4: FAST4,
  advantageBestOf3: ADVANTAGE_BEST_OF_3,
} as const satisfies Record<string, ScoringFormat>;

export type ScoringPresetName = keyof typeof SCORING_PRESETS;

/** Points for a 10-point match tiebreak, regardless of the set tiebreak length. */
export const MATCH_TIEBREAK_TO = 10;

/* ------------------------------------------------------------------------- */
/* Format validation                                                          */
/* ------------------------------------------------------------------------- */

export function validateScoringFormat(format: ScoringFormat): void {
  const fail = (message: string): never => {
    throw engineError('INVALID_SCORING_FORMAT', message, { ...format });
  };

  if (!Number.isInteger(format.setsToWin) || format.setsToWin < 1) {
    fail('setsToWin must be a positive integer');
  }
  if (!Number.isInteger(format.gamesPerSet) || format.gamesPerSet < 1) {
    fail('gamesPerSet must be a positive integer');
  }
  if (format.tiebreakAt !== null) {
    if (!Number.isInteger(format.tiebreakAt) || format.tiebreakAt < 1) {
      fail('tiebreakAt must be a positive integer or null');
    }
    if (format.tiebreakAt > format.gamesPerSet) {
      // A tiebreak triggered above the games target could never be reached.
      fail('tiebreakAt cannot exceed gamesPerSet');
    }
    if (!Number.isInteger(format.tiebreakTo) || format.tiebreakTo < 1) {
      fail('tiebreakTo must be a positive integer');
    }
  }
  if (format.decidingSetMode === 'matchTiebreak' && format.setsToWin < 2) {
    // With one set to win there is no deciding set to replace.
    fail('matchTiebreak requires setsToWin of at least 2');
  }
}

/* ------------------------------------------------------------------------- */
/* Tiebreak points                                                            */
/* ------------------------------------------------------------------------- */

/** A tiebreak is won by reaching the target with a margin of two. */
export function isValidTiebreak(a: number, b: number, target: number, adScoring = true): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi < target) return false;
  // No-ad tiebreaks are decided by a single sudden-death point at target-1 all.
  if (!adScoring) return hi === target && lo <= target - 1 && hi > lo;
  if (hi === target) return lo <= target - 2;
  return hi - lo === 2;
}

/* ------------------------------------------------------------------------- */
/* Sets                                                                       */
/* ------------------------------------------------------------------------- */

export interface SetGames {
  readonly side0Games: number;
  readonly side1Games: number;
  readonly side0TiebreakPoints?: number | null | undefined;
  readonly side1TiebreakPoints?: number | null | undefined;
}

function hasTiebreakPoints(set: SetGames): boolean {
  return (
    typeof set.side0TiebreakPoints === 'number' && typeof set.side1TiebreakPoints === 'number'
  );
}

/**
 * Is this a legally completed set?
 *
 * The three shapes a standard set can take: a straight win to the games target
 * (6-0 through 6-4), a two-game win just past it (7-5), and a tiebreak set
 * (7-6, which must carry tiebreak points).
 *
 * Two variations matter:
 *
 *   tiebreakAt === null  — advantage set. Reach the target and win by two,
 *                          with no upper bound: 8-6, 10-8, 24-22.
 *
 *   tiebreakAt < games   — Fast4-style. The tiebreak fires *before* the games
 *                          target, so there is no 7-5 analogue: 4-0, 4-1, 4-2,
 *                          or 4-3 off a tiebreak. Getting this wrong would
 *                          admit a 5-3 Fast4 set, which cannot happen.
 */
export function isCompletedSet(set: SetGames, format: ScoringFormat): boolean {
  const { side0Games: a, side1Games: b } = set;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  if (a === b) return false;

  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const games = format.gamesPerSet;
  const tiebreakAt = format.tiebreakAt;

  if (tiebreakAt === null) {
    return hi >= games && hi - lo >= 2;
  }

  const isTiebreakScore = hi === tiebreakAt + 1 && lo === tiebreakAt;
  if (isTiebreakScore) {
    return (
      hasTiebreakPoints(set) &&
      isValidTiebreak(
        set.side0TiebreakPoints as number,
        set.side1TiebreakPoints as number,
        format.tiebreakTo,
        format.adScoring,
      )
    );
  }

  if (tiebreakAt === games) {
    if (hi === games && lo <= games - 2) return true;
    if (hi === games + 1 && lo === games - 1) return true;
    return false;
  }

  // tiebreakAt < gamesPerSet: straight win only, below the tiebreak trigger.
  return hi === games && lo <= tiebreakAt - 1;
}

/**
 * A deciding set played as a match tiebreak. Recorded as one game to nil with
 * tiebreak points to 10, so it still occupies a set slot in the score line.
 */
export function isCompletedMatchTiebreak(set: SetGames, format: ScoringFormat): boolean {
  const { side0Games: a, side1Games: b } = set;
  if (!(Math.max(a, b) === 1 && Math.min(a, b) === 0)) return false;
  if (!hasTiebreakPoints(set)) return false;

  const p = set.side0TiebreakPoints as number;
  const q = set.side1TiebreakPoints as number;
  if (!isValidTiebreak(p, q, MATCH_TIEBREAK_TO, format.adScoring)) return false;
  // The game and the tiebreak must agree on who won.
  return a > b ? p > q : q > p;
}

/** 0 or 1 for the winning side, or null if the set is not a completed set. */
export function setWinner(
  set: SetGames,
  format: ScoringFormat,
  isDecidingSet = false,
): 0 | 1 | null {
  const asMatchTiebreak = isDecidingSet && format.decidingSetMode === 'matchTiebreak';

  if (asMatchTiebreak) {
    if (!isCompletedMatchTiebreak(set, format)) return null;
    return set.side0Games > set.side1Games ? 0 : 1;
  }

  if (!isCompletedSet(set, format)) return null;
  return set.side0Games > set.side1Games ? 0 : 1;
}

/** Is this set index the deciding set under the given format? */
export function isDecidingSetIndex(index: number, format: ScoringFormat): boolean {
  return index === format.setsToWin * 2 - 2;
}

/* ------------------------------------------------------------------------- */
/* Matches                                                                    */
/* ------------------------------------------------------------------------- */

export interface MatchScoreSummary {
  /** 0 or 1, or null when the sets played do not decide the match. */
  readonly winner: 0 | 1 | null;
  readonly setsWon: readonly [number, number];
  readonly gamesWon: readonly [number, number];
  /** Sets that are legally complete. Trailing partial sets are excluded. */
  readonly completedSets: number;
  /** True when a trailing set exists but is not complete (a retirement). */
  readonly hasPartialSet: boolean;
}

/**
 * Summarise a score line.
 *
 * Only *completed* sets contribute to set and game counts. A trailing partial
 * set — the 3-2 when somebody retires — contributes neither its set nor its
 * games. A set that was never finished is not a data point, and letting a
 * partial set feed the games-percentage tiebreaker would let an abandoned match
 * outweigh a completed one.
 */
export function summariseMatch(
  sets: readonly SetGames[],
  format: ScoringFormat,
): MatchScoreSummary {
  validateScoringFormat(format);

  let setsFor0 = 0;
  let setsFor1 = 0;
  let gamesFor0 = 0;
  let gamesFor1 = 0;
  let completedSets = 0;
  let hasPartialSet = false;
  let winner: 0 | 1 | null = null;

  for (const [index, set] of sets.entries()) {
    const deciding = isDecidingSetIndex(index, format);
    const won = setWinner(set, format, deciding);

    if (won === null) {
      hasPartialSet = true;
      continue;
    }

    completedSets++;
    if (won === 0) setsFor0++;
    else setsFor1++;

    // A match tiebreak is one game to nil; counting it as a game played would
    // distort game percentages against matches that went to a real third set.
    if (!(deciding && format.decidingSetMode === 'matchTiebreak')) {
      gamesFor0 += set.side0Games;
      gamesFor1 += set.side1Games;
    }

    if (setsFor0 === format.setsToWin) winner = 0;
    else if (setsFor1 === format.setsToWin) winner = 1;
    if (winner !== null) break;
  }

  return {
    winner,
    setsWon: [setsFor0, setsFor1],
    gamesWon: [gamesFor0, gamesFor1],
    completedSets,
    hasPartialSet,
  };
}

/** Convenience: strip the index off a persisted SetScore row. */
export function toSetGames(set: SetScore): SetGames {
  return {
    side0Games: set.side0Games,
    side1Games: set.side1Games,
    side0TiebreakPoints: set.side0TiebreakPoints,
    side1TiebreakPoints: set.side1TiebreakPoints,
  };
}
