import { describe, expect, it } from 'vitest';
import { EngineError } from './errors.js';
import { BEST_OF_3 } from './scoring.js';
import {
  DEFAULT_POINTS,
  computeStandings,
  headToHead,
  recordFor,
  type MatchResultInput,
} from './standings.js';
import type { MatchOutcome } from './types.js';

function set(a: number, b: number, tbA?: number, tbB?: number) {
  return {
    side0Games: a,
    side1Games: b,
    side0TiebreakPoints: tbA ?? null,
    side1TiebreakPoints: tbB ?? null,
  };
}

let counter = 0;
function result(
  a: string,
  b: string,
  sets: ReturnType<typeof set>[],
  outcome: MatchOutcome = 'completed',
  winnerEntrantId?: string,
): MatchResultInput {
  return {
    matchId: `m${counter++}`,
    side0EntrantId: a,
    side1EntrantId: b,
    outcome,
    sets,
    ...(winnerEntrantId === undefined ? {} : { winnerEntrantId }),
  };
}

function standings(entrantIds: string[], results: MatchResultInput[]) {
  return computeStandings({ entrantIds, results, format: BEST_OF_3 });
}

describe('computeStandings', () => {
  it('starts everyone at zero', () => {
    const table = standings(['a', 'b', 'c'], []);
    expect(table.records).toHaveLength(3);
    for (const r of table.records) {
      expect(r).toMatchObject({
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        setsWon: 0,
        gamesWon: 0,
        points: 0,
        setPct: 0,
        gamePct: 0,
      });
    }
  });

  it('returns records in the order entrants were given', () => {
    const table = standings(['c', 'a', 'b'], []);
    expect(table.records.map((r) => r.entrantId)).toEqual(['c', 'a', 'b']);
  });

  it('counts a straightforward win', () => {
    const table = standings(['a', 'b'], [result('a', 'b', [set(6, 4), set(6, 2)])]);

    expect(recordFor(table, 'a')).toMatchObject({
      matchesPlayed: 1,
      matchesWon: 1,
      matchesLost: 0,
      setsWon: 2,
      setsLost: 0,
      gamesWon: 12,
      gamesLost: 6,
      points: 1,
      setPct: 1,
    });
    expect(recordFor(table, 'b')).toMatchObject({
      matchesPlayed: 1,
      matchesWon: 0,
      matchesLost: 1,
      setsWon: 0,
      setsLost: 2,
      gamesWon: 6,
      gamesLost: 12,
      points: 0,
      setPct: 0,
    });
  });

  it('mirrors sets and games between the two sides', () => {
    const table = standings(['a', 'b'], [result('a', 'b', [set(4, 6), set(7, 5), set(6, 3)])]);
    const a = recordFor(table, 'a');
    const b = recordFor(table, 'b');

    expect(a.setsWon).toBe(b.setsLost);
    expect(a.setsLost).toBe(b.setsWon);
    expect(a.gamesWon).toBe(b.gamesLost);
    expect(a.gamesLost).toBe(b.gamesWon);
  });

  it('computes percentages', () => {
    // a wins 2-1 in sets; games are 6+4+7 = 17 to 4+6+5 = 15, so 32 played.
    const table = standings(['a', 'b'], [result('a', 'b', [set(6, 4), set(4, 6), set(7, 5)])]);
    const a = recordFor(table, 'a');
    expect(a.setsWon).toBe(2);
    expect(a.gamesWon).toBe(17);
    expect(a.gamesLost).toBe(15);
    expect(a.setPct).toBeCloseTo(2 / 3, 10);
    expect(a.gamePct).toBeCloseTo(17 / 32, 10);
  });

  it('accumulates across several matches', () => {
    const table = standings(
      ['a', 'b', 'c'],
      [
        result('a', 'b', [set(6, 0), set(6, 0)]),
        result('a', 'c', [set(6, 1), set(6, 1)]),
        result('b', 'c', [set(6, 2), set(6, 2)]),
      ],
    );

    expect(recordFor(table, 'a')).toMatchObject({ matchesWon: 2, setsWon: 4, points: 2 });
    expect(recordFor(table, 'b')).toMatchObject({ matchesWon: 1, matchesLost: 1, points: 1 });
    expect(recordFor(table, 'c')).toMatchObject({ matchesWon: 0, matchesLost: 2, points: 0 });
  });

  describe('walkovers and defaults', () => {
    it('award the match but contribute no sets and no games', () => {
      // Counting a walkover as 6-0 6-0 would inflate the percentages that break
      // ties, letting someone who never hit a ball outrank a hard three-setter.
      const table = standings(['a', 'b'], [result('a', 'b', [], 'walkover', 'a')]);

      expect(recordFor(table, 'a')).toMatchObject({
        matchesPlayed: 1,
        matchesWon: 1,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 1,
        setPct: 0,
        gamePct: 0,
      });
      expect(recordFor(table, 'b')).toMatchObject({ matchesLost: 1, setsLost: 0, gamesLost: 0 });
    });

    it('treat a default the same way, but as a distinct outcome', () => {
      const table = standings(['a', 'b'], [result('a', 'b', [], 'default', 'b')]);
      expect(recordFor(table, 'b').matchesWon).toBe(1);
      expect(recordFor(table, 'a').gamesLost).toBe(0);
    });

    it('ignore any sets mistakenly attached to them', () => {
      const table = standings(['a', 'b'], [result('a', 'b', [set(6, 0), set(6, 0)], 'walkover', 'a')]);
      expect(recordFor(table, 'a').gamesWon).toBe(0);
      expect(recordFor(table, 'a').setsWon).toBe(0);
    });

    it('can be scored separately from a played loss', () => {
      const table = computeStandings({
        entrantIds: ['a', 'b', 'c'],
        results: [
          result('a', 'b', [set(6, 4), set(6, 4)]),
          result('a', 'c', [], 'walkover', 'a'),
        ],
        format: BEST_OF_3,
        points: { win: 2, lossPlayed: 1, lossWalkover: 0 },
      });

      expect(recordFor(table, 'a').points).toBe(4);
      expect(recordFor(table, 'b').points).toBe(1); // played and lost
      expect(recordFor(table, 'c').points).toBe(0); // did not turn up
    });
  });

  describe('retirements', () => {
    it('count completed sets and games, but not the partial set', () => {
      // a leads 6-4, 3-2 when b retires.
      const table = standings(
        ['a', 'b'],
        [result('a', 'b', [set(6, 4), set(3, 2)], 'retirement', 'a')],
      );

      expect(recordFor(table, 'a')).toMatchObject({
        matchesPlayed: 1,
        matchesWon: 1,
        setsWon: 1,
        setsLost: 0,
        gamesWon: 6,
        gamesLost: 4,
        points: 1,
      });
      expect(recordFor(table, 'b')).toMatchObject({ matchesLost: 1, setsLost: 1, gamesWon: 4 });
    });

    it('can be won by the player who was behind on the scoreboard', () => {
      // a leads 6-4 but retires, so b wins having lost the only complete set.
      const table = standings(
        ['a', 'b'],
        [result('a', 'b', [set(6, 4), set(1, 0)], 'retirement', 'b')],
      );

      expect(recordFor(table, 'b')).toMatchObject({ matchesWon: 1, setsWon: 0, setsLost: 1 });
      expect(recordFor(table, 'a')).toMatchObject({ matchesLost: 1, setsWon: 1 });
    });

    it('contribute nothing but the match when retirement comes in set one', () => {
      const table = standings(['a', 'b'], [result('a', 'b', [set(2, 1)], 'retirement', 'a')]);
      expect(recordFor(table, 'a')).toMatchObject({
        matchesPlayed: 1,
        matchesWon: 1,
        setsWon: 0,
        gamesWon: 0,
      });
    });
  });

  describe('unfinished matches', () => {
    it('contribute nothing at all and are reported as ignored', () => {
      const table = standings(
        ['a', 'b'],
        [{ ...result('a', 'b', [set(6, 4)]), outcome: 'unfinished' }],
      );

      expect(recordFor(table, 'a')).toMatchObject({ matchesPlayed: 0, setsWon: 0, points: 0 });
      expect(table.ignoredMatchIds).toHaveLength(1);
    });

    it('need no winner', () => {
      expect(() =>
        standings(['a', 'b'], [{ ...result('a', 'b', []), outcome: 'unfinished' }]),
      ).not.toThrow();
    });
  });

  describe('head-to-head', () => {
    it('records who beat whom', () => {
      const table = standings(['a', 'b'], [result('a', 'b', [set(6, 4), set(6, 4)])]);
      expect(headToHead(table, 'a', 'b')).toBe(1);
      expect(headToHead(table, 'b', 'a')).toBe(-1);
    });

    it('is zero for entrants who have not met', () => {
      expect(headToHead(standings(['a', 'b'], []), 'a', 'b')).toBe(0);
    });

    it('nets out to zero on a 1-1 split in a double round robin', () => {
      // Head-to-head cannot resolve this; the cascade must fall through.
      const table = standings(
        ['a', 'b'],
        [
          result('a', 'b', [set(6, 4), set(6, 4)]),
          result('b', 'a', [set(6, 3), set(6, 3)]),
        ],
      );
      expect(headToHead(table, 'a', 'b')).toBe(0);
    });

    it('counts a walkover win as a head-to-head win', () => {
      const table = standings(['a', 'b'], [result('a', 'b', [], 'walkover', 'a')]);
      expect(headToHead(table, 'a', 'b')).toBe(1);
    });
  });

  describe('validation', () => {
    it('rejects a result referencing an entrant outside the group', () => {
      expect(() => standings(['a', 'b'], [result('a', 'z', [set(6, 0), set(6, 0)])])).toThrow(
        /not in the group/,
      );
    });

    it('rejects an entrant playing themselves', () => {
      expect(() => standings(['a'], [result('a', 'a', [set(6, 0), set(6, 0)])])).toThrow(
        /same entrant on both sides/,
      );
    });

    it('rejects a completed match the sets do not decide', () => {
      expect(() => standings(['a', 'b'], [result('a', 'b', [set(6, 4)])])).toThrow(
        /do not decide it/,
      );
    });

    it('rejects a declared winner the score contradicts', () => {
      expect(() =>
        standings(['a', 'b'], [result('a', 'b', [set(6, 4), set(6, 4)], 'completed', 'b')]),
      ).toThrow(/contradicts/);
    });

    it('accepts a declared winner that agrees with the score', () => {
      expect(() =>
        standings(['a', 'b'], [result('a', 'b', [set(6, 4), set(6, 4)], 'completed', 'a')]),
      ).not.toThrow();
    });

    it('requires an explicit winner for a walkover', () => {
      expect(() => standings(['a', 'b'], [result('a', 'b', [], 'walkover')])).toThrow(
        /needs an explicit winner/,
      );
    });

    it('requires an explicit winner for a retirement', () => {
      expect(() => standings(['a', 'b'], [result('a', 'b', [set(3, 2)], 'retirement')])).toThrow(
        /needs an explicit winner/,
      );
    });

    it('rejects a declared winner who is not in the match', () => {
      expect(() =>
        standings(['a', 'b', 'c'], [result('a', 'b', [], 'walkover', 'c')]),
      ).toThrow(/not playing in it/);
    });

    it('carries a machine-readable code', () => {
      try {
        standings(['a', 'b'], [result('a', 'z', [set(6, 0), set(6, 0)])]);
      } catch (e) {
        expect((e as EngineError).code).toBe('UNKNOWN_ENTRANT');
      }
    });
  });

  describe('points schemes', () => {
    it('defaults to one for a win', () => {
      expect(DEFAULT_POINTS).toEqual({ win: 1, lossPlayed: 0, lossWalkover: 0 });
    });

    it('supports a two-for-win, one-for-played-loss league scheme', () => {
      const table = computeStandings({
        entrantIds: ['a', 'b'],
        results: [result('a', 'b', [set(6, 4), set(6, 4)])],
        format: BEST_OF_3,
        points: { win: 2, lossPlayed: 1, lossWalkover: 0 },
      });
      expect(recordFor(table, 'a').points).toBe(2);
      expect(recordFor(table, 'b').points).toBe(1);
    });
  });

  it('handles a full six-entrant round robin consistently', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const results: MatchResultInput[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        // Lower index always wins, so standings should be strictly ordered.
        results.push(result(ids[i] as string, ids[j] as string, [set(6, 2), set(6, 2)]));
      }
    }

    const table = standings(ids, results);
    expect(table.records.map((r) => r.matchesWon)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(table.records.map((r) => r.matchesPlayed)).toEqual([5, 5, 5, 5, 5, 5]);

    // Every match contributed two sets to one side and two losses to the other.
    const totalSets = table.records.reduce((s, r) => s + r.setsWon, 0);
    expect(totalSets).toBe(results.length * 2);
  });
});

describe('recordFor', () => {
  it('throws for an unknown entrant rather than returning undefined', () => {
    expect(() => recordFor(standings(['a'], []), 'zzz')).toThrow(/No record for entrant/);
  });
});
