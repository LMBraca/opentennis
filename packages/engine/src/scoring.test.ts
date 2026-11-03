import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import {
  ADVANTAGE_BEST_OF_3,
  BEST_OF_3,
  BEST_OF_3_MATCH_TIEBREAK,
  BEST_OF_5,
  FAST4,
  PRO_SET_8,
  SCORING_PRESETS,
  SINGLE_SET_6,
  isCompletedMatchTiebreak,
  isCompletedSet,
  isDecidingSetIndex,
  isValidTiebreak,
  setWinner,
  summariseMatch,
  toSetGames,
  validateScoringFormat,
} from './scoring';
import type { ScoringFormat } from './types';

/** Terse set builder: games plus optional tiebreak points. */
function set(a: number, b: number, tbA?: number, tbB?: number) {
  return {
    side0Games: a,
    side1Games: b,
    side0TiebreakPoints: tbA ?? null,
    side1TiebreakPoints: tbB ?? null,
  };
}

describe('presets', () => {
  it('all validate', () => {
    for (const [name, format] of Object.entries(SCORING_PRESETS)) {
      expect(() => validateScoringFormat(format), name).not.toThrow();
    }
  });

  it('match the published table', () => {
    expect(BEST_OF_3.setsToWin).toBe(2);
    expect(BEST_OF_5.setsToWin).toBe(3);
    expect(PRO_SET_8).toMatchObject({ setsToWin: 1, gamesPerSet: 8, tiebreakAt: 8 });
    expect(SINGLE_SET_6).toMatchObject({ setsToWin: 1, gamesPerSet: 6, tiebreakAt: 6 });
    expect(FAST4).toMatchObject({ gamesPerSet: 4, tiebreakAt: 3, adScoring: false });
    expect(BEST_OF_3_MATCH_TIEBREAK.decidingSetMode).toBe('matchTiebreak');
  });
});

describe('validateScoringFormat', () => {
  const base = BEST_OF_3;

  it('rejects a non-positive sets target', () => {
    expect(() => validateScoringFormat({ ...base, setsToWin: 0 })).toThrow(EngineError);
  });

  it('rejects a tiebreak trigger above the games target', () => {
    // It could never be reached.
    expect(() => validateScoringFormat({ ...base, tiebreakAt: 7 })).toThrow(/cannot exceed/);
  });

  it('rejects a match tiebreak with only one set to win', () => {
    // There is no deciding set to replace.
    expect(() =>
      validateScoringFormat({ ...SINGLE_SET_6, decidingSetMode: 'matchTiebreak' }),
    ).toThrow(/at least 2/);
  });

  it('rejects fractional targets', () => {
    expect(() => validateScoringFormat({ ...base, gamesPerSet: 6.5 })).toThrow(EngineError);
  });

  it('accepts an advantage format with a null tiebreak', () => {
    expect(() => validateScoringFormat(ADVANTAGE_BEST_OF_3)).not.toThrow();
  });

  it('rejects a non-positive tiebreak target', () => {
    expect(() => validateScoringFormat({ ...base, tiebreakTo: 0 })).toThrow(/tiebreakTo/);
  });

  it('rejects a non-positive tiebreak trigger', () => {
    expect(() => validateScoringFormat({ ...base, tiebreakAt: 0 })).toThrow(/tiebreakAt/);
  });
});

describe('toSetGames', () => {
  it('strips the index off a persisted set row', () => {
    expect(
      toSetGames({
        index: 2,
        side0Games: 7,
        side1Games: 6,
        side0TiebreakPoints: 7,
        side1TiebreakPoints: 4,
      }),
    ).toEqual({
      side0Games: 7,
      side1Games: 6,
      side0TiebreakPoints: 7,
      side1TiebreakPoints: 4,
    });
  });

  it('round-trips into isCompletedSet', () => {
    const row = {
      index: 0,
      side0Games: 6,
      side1Games: 4,
      side0TiebreakPoints: null,
      side1TiebreakPoints: null,
    };
    expect(isCompletedSet(toSetGames(row), BEST_OF_3)).toBe(true);
  });
});

describe('isValidTiebreak', () => {
  it('accepts reaching the target with a two-point margin', () => {
    expect(isValidTiebreak(7, 5, 7)).toBe(true);
    expect(isValidTiebreak(7, 0, 7)).toBe(true);
    expect(isValidTiebreak(9, 7, 7)).toBe(true);
    expect(isValidTiebreak(15, 13, 7)).toBe(true);
  });

  it('rejects reaching the target by one', () => {
    expect(isValidTiebreak(7, 6, 7)).toBe(false);
  });

  it('rejects falling short of the target', () => {
    expect(isValidTiebreak(6, 4, 7)).toBe(false);
  });

  it('rejects a margin above two once past the target', () => {
    // 10-7 cannot happen: the tiebreak ends the moment the margin hits two.
    expect(isValidTiebreak(10, 7, 7)).toBe(false);
  });

  it('allows a one-point win at the target under no-ad', () => {
    expect(isValidTiebreak(5, 4, 5, false)).toBe(true);
    expect(isValidTiebreak(6, 4, 5, false)).toBe(false);
  });

  it('rejects negatives, ties, and fractions', () => {
    expect(isValidTiebreak(-1, 7, 7)).toBe(false);
    expect(isValidTiebreak(7, 7, 7)).toBe(false);
    expect(isValidTiebreak(7.5, 2, 7)).toBe(false);
  });
});

describe('isCompletedSet — standard (6 games, tiebreak at 6)', () => {
  const f = BEST_OF_3;

  it('accepts straight wins to six', () => {
    for (let lo = 0; lo <= 4; lo++) {
      expect(isCompletedSet(set(6, lo), f), `6-${lo}`).toBe(true);
      expect(isCompletedSet(set(lo, 6), f), `${lo}-6`).toBe(true);
    }
  });

  it('rejects 6-5, which is not a finished set', () => {
    expect(isCompletedSet(set(6, 5), f)).toBe(false);
  });

  it('accepts 7-5', () => {
    expect(isCompletedSet(set(7, 5), f)).toBe(true);
    expect(isCompletedSet(set(5, 7), f)).toBe(true);
  });

  it('accepts 7-6 only with a valid tiebreak', () => {
    expect(isCompletedSet(set(7, 6, 7, 4), f)).toBe(true);
    expect(isCompletedSet(set(7, 6, 9, 7), f)).toBe(true);
    expect(isCompletedSet(set(7, 6), f)).toBe(false);
    expect(isCompletedSet(set(7, 6, 7, 6), f)).toBe(false);
  });

  it('requires the tiebreak to agree is not its job — but the games must be 7-6', () => {
    expect(isCompletedSet(set(8, 6, 7, 4), f)).toBe(false);
  });

  it('rejects impossible and in-progress scores', () => {
    for (const [a, b] of [
      [0, 0],
      [3, 2],
      [5, 5],
      [8, 6],
      [9, 7],
      [6, 6],
      [4, 4],
    ] as const) {
      expect(isCompletedSet(set(a, b), f), `${a}-${b}`).toBe(false);
    }
  });

  /** Exhaustive table, per formats spec §6.5. */
  it('matches a hand-written table over 0..15', () => {
    const valid = new Set([
      '6-0',
      '6-1',
      '6-2',
      '6-3',
      '6-4',
      '7-5',
      '0-6',
      '1-6',
      '2-6',
      '3-6',
      '4-6',
      '5-7',
    ]);
    for (let a = 0; a <= 15; a++) {
      for (let b = 0; b <= 15; b++) {
        // 7-6 needs tiebreak points, so it is excluded from this table.
        if ((a === 7 && b === 6) || (a === 6 && b === 7)) continue;
        expect(isCompletedSet(set(a, b), f), `${a}-${b}`).toBe(valid.has(`${a}-${b}`));
      }
    }
  });
});

describe('isCompletedSet — pro set to 8', () => {
  const f = PRO_SET_8;

  it('accepts straight wins to eight', () => {
    expect(isCompletedSet(set(8, 0), f)).toBe(true);
    expect(isCompletedSet(set(8, 6), f)).toBe(true);
  });

  it('rejects 8-7', () => {
    expect(isCompletedSet(set(8, 7), f)).toBe(false);
  });

  it('accepts 9-7 and 9-8 with a tiebreak', () => {
    expect(isCompletedSet(set(9, 7), f)).toBe(true);
    expect(isCompletedSet(set(9, 8, 7, 3), f)).toBe(true);
    expect(isCompletedSet(set(9, 8), f)).toBe(false);
  });
});

describe('isCompletedSet — Fast4 (games to 4, tiebreak at 3)', () => {
  const f = FAST4;

  it('accepts straight wins below the tiebreak trigger', () => {
    expect(isCompletedSet(set(4, 0), f)).toBe(true);
    expect(isCompletedSet(set(4, 1), f)).toBe(true);
    expect(isCompletedSet(set(4, 2), f)).toBe(true);
  });

  it('accepts 4-3 only off a tiebreak', () => {
    expect(isCompletedSet(set(4, 3, 5, 3), f)).toBe(true);
    expect(isCompletedSet(set(4, 3), f)).toBe(false);
  });

  it('rejects 5-3, which the generic 7-5 rule would wrongly admit', () => {
    // The tiebreak fires at 3-3, so a set can never reach five games. This is
    // the case that makes tiebreakAt < gamesPerSet worth special-casing.
    expect(isCompletedSet(set(5, 3), f)).toBe(false);
    expect(isCompletedSet(set(5, 4), f)).toBe(false);
  });

  it('honours the no-ad tiebreak length of five', () => {
    expect(isCompletedSet(set(4, 3, 5, 4), f)).toBe(true);
    expect(isCompletedSet(set(4, 3, 7, 5), f)).toBe(false);
  });
});

describe('isCompletedSet — advantage sets (no tiebreak)', () => {
  const f = ADVANTAGE_BEST_OF_3;

  it('accepts any two-game win at or above six', () => {
    expect(isCompletedSet(set(6, 4), f)).toBe(true);
    expect(isCompletedSet(set(8, 6), f)).toBe(true);
    expect(isCompletedSet(set(24, 22), f)).toBe(true);
  });

  it('rejects a one-game margin however long the set', () => {
    expect(isCompletedSet(set(7, 6), f)).toBe(false);
    expect(isCompletedSet(set(25, 24), f)).toBe(false);
  });

  it('rejects anything short of the games target', () => {
    expect(isCompletedSet(set(5, 3), f)).toBe(false);
  });
});

describe('isCompletedMatchTiebreak', () => {
  const f = BEST_OF_3_MATCH_TIEBREAK;

  it('accepts one game to nil with a ten-point tiebreak', () => {
    expect(isCompletedMatchTiebreak(set(1, 0, 10, 6), f)).toBe(true);
    expect(isCompletedMatchTiebreak(set(0, 1, 8, 10), f)).toBe(true);
    expect(isCompletedMatchTiebreak(set(1, 0, 12, 10), f)).toBe(true);
  });

  it('rejects a tiebreak short of ten', () => {
    expect(isCompletedMatchTiebreak(set(1, 0, 7, 5), f)).toBe(false);
  });

  it('rejects a game count that disagrees with the tiebreak winner', () => {
    expect(isCompletedMatchTiebreak(set(1, 0, 6, 10), f)).toBe(false);
  });

  it('rejects anything other than 1-0 in games', () => {
    expect(isCompletedMatchTiebreak(set(6, 4, 10, 2), f)).toBe(false);
    expect(isCompletedMatchTiebreak(set(0, 0, 10, 2), f)).toBe(false);
  });

  it('requires tiebreak points at all', () => {
    expect(isCompletedMatchTiebreak(set(1, 0), f)).toBe(false);
  });
});

describe('isDecidingSetIndex', () => {
  it('is the third set of a best-of-three', () => {
    expect(isDecidingSetIndex(0, BEST_OF_3)).toBe(false);
    expect(isDecidingSetIndex(1, BEST_OF_3)).toBe(false);
    expect(isDecidingSetIndex(2, BEST_OF_3)).toBe(true);
  });

  it('is the fifth set of a best-of-five', () => {
    expect(isDecidingSetIndex(4, BEST_OF_5)).toBe(true);
    expect(isDecidingSetIndex(2, BEST_OF_5)).toBe(false);
  });
});

describe('setWinner', () => {
  it('names the side with more games', () => {
    expect(setWinner(set(6, 4), BEST_OF_3)).toBe(0);
    expect(setWinner(set(4, 6), BEST_OF_3)).toBe(1);
  });

  it('is null for an unfinished set', () => {
    expect(setWinner(set(3, 2), BEST_OF_3)).toBeNull();
  });

  it('switches to match-tiebreak rules on the deciding set', () => {
    const f = BEST_OF_3_MATCH_TIEBREAK;
    expect(setWinner(set(1, 0, 10, 5), f, true)).toBe(0);
    // The same score is not a legal ordinary set.
    expect(setWinner(set(1, 0, 10, 5), f, false)).toBeNull();
  });
});

describe('summariseMatch', () => {
  it('decides a straight-sets win', () => {
    const s = summariseMatch([set(6, 4), set(6, 2)], BEST_OF_3);
    expect(s.winner).toBe(0);
    expect(s.setsWon).toEqual([2, 0]);
    expect(s.gamesWon).toEqual([12, 6]);
    expect(s.completedSets).toBe(2);
    expect(s.hasPartialSet).toBe(false);
  });

  it('decides a three-set win', () => {
    const s = summariseMatch([set(4, 6), set(7, 6, 7, 4), set(6, 3)], BEST_OF_3);
    expect(s.winner).toBe(0);
    expect(s.setsWon).toEqual([2, 1]);
    expect(s.gamesWon).toEqual([17, 15]);
  });

  it('stops counting once the match is decided', () => {
    // A fourth set cannot exist in a best-of-three; ignore it rather than
    // letting bad data inflate the totals.
    const s = summariseMatch([set(6, 0), set(6, 0), set(6, 0)], BEST_OF_3);
    expect(s.setsWon).toEqual([2, 0]);
    expect(s.gamesWon).toEqual([12, 0]);
    expect(s.completedSets).toBe(2);
  });

  it('returns no winner when the sets do not decide the match', () => {
    const s = summariseMatch([set(6, 4)], BEST_OF_3);
    expect(s.winner).toBeNull();
    expect(s.setsWon).toEqual([1, 0]);
  });

  describe('retirements', () => {
    it('counts completed sets and ignores the trailing partial set', () => {
      // 6-4, 3-2 and the opponent retires.
      const s = summariseMatch([set(6, 4), set(3, 2)], BEST_OF_3);
      expect(s.setsWon).toEqual([1, 0]);
      expect(s.gamesWon).toEqual([6, 4]);
      expect(s.completedSets).toBe(1);
      expect(s.hasPartialSet).toBe(true);
      expect(s.winner).toBeNull();
    });

    it('excludes the partial set from game counts entirely', () => {
      // Letting an abandoned set feed the games-percentage tiebreaker would let
      // an unfinished match outweigh a completed one.
      const withPartial = summariseMatch([set(6, 4), set(5, 0)], BEST_OF_3);
      const withoutPartial = summariseMatch([set(6, 4)], BEST_OF_3);
      expect(withPartial.gamesWon).toEqual(withoutPartial.gamesWon);
    });

    it('reports a retirement in the very first set as no data at all', () => {
      const s = summariseMatch([set(2, 1)], BEST_OF_3);
      expect(s.setsWon).toEqual([0, 0]);
      expect(s.gamesWon).toEqual([0, 0]);
      expect(s.completedSets).toBe(0);
      expect(s.hasPartialSet).toBe(true);
    });
  });

  describe('match tiebreak decider', () => {
    const f = BEST_OF_3_MATCH_TIEBREAK;

    it('counts the decider as a set but not as games', () => {
      // Counting 1-0 as a game played would distort game percentages against
      // matches that went to a real third set.
      const s = summariseMatch([set(6, 4), set(3, 6), set(1, 0, 10, 7)], f);
      expect(s.winner).toBe(0);
      expect(s.setsWon).toEqual([2, 1]);
      expect(s.gamesWon).toEqual([9, 10]);
      expect(s.completedSets).toBe(3);
    });

    it('still validates the first two sets normally', () => {
      const s = summariseMatch([set(1, 0, 10, 7), set(6, 4)], f);
      // Set 0 is not the decider, so 1-0 is not a legal set there.
      expect(s.completedSets).toBe(1);
      expect(s.hasPartialSet).toBe(true);
    });
  });

  it('handles an empty score line', () => {
    const s = summariseMatch([], BEST_OF_3);
    expect(s).toMatchObject({
      winner: null,
      setsWon: [0, 0],
      gamesWon: [0, 0],
      completedSets: 0,
      hasPartialSet: false,
    });
  });

  it('handles a single-set format', () => {
    const s = summariseMatch([set(8, 6)], PRO_SET_8);
    expect(s.winner).toBe(0);
    expect(s.setsWon).toEqual([1, 0]);
  });

  it('handles best of five going the distance', () => {
    const sets = [set(6, 4), set(4, 6), set(6, 4), set(4, 6), set(6, 4)];
    const s = summariseMatch(sets, BEST_OF_5);
    expect(s.winner).toBe(0);
    expect(s.setsWon).toEqual([3, 2]);
    expect(s.gamesWon).toEqual([26, 24]);
  });

  it('rejects an invalid format rather than summarising nonsense', () => {
    const bad = { ...BEST_OF_3, setsToWin: 0 } as ScoringFormat;
    expect(() => summariseMatch([set(6, 4)], bad)).toThrow(EngineError);
  });
});
