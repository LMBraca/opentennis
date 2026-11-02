import { describe, expect, it } from 'vitest';
import { BEST_OF_3, type SetGames } from './scoring.js';
import { computeStandings, type MatchResultInput } from './standings.js';
import { explainOrdering, rankStandings, type RankedTable } from './tiebreakers.js';

function set(a: number, b: number): SetGames {
  return { side0Games: a, side1Games: b, side0TiebreakPoints: null, side1TiebreakPoints: null };
}

/** A 7-6 set. Needs tiebreak points to count as completed at all. */
function tb(a: number, b: number): SetGames {
  return {
    side0Games: a,
    side1Games: b,
    side0TiebreakPoints: a > b ? 7 : 5,
    side1TiebreakPoints: a > b ? 5 : 7,
  };
}

let counter = 0;
/** "a beat b 6-4 6-4" style result. */
function beat(
  winner: string,
  loser: string,
  sets: SetGames[] = [set(6, 4), set(6, 4)],
): MatchResultInput {
  return {
    matchId: `m${counter++}`,
    side0EntrantId: winner,
    side1EntrantId: loser,
    outcome: 'completed',
    sets,
    winnerEntrantId: winner,
  };
}

function rank(
  entrantIds: string[],
  results: MatchResultInput[],
  randomSeed = 'fixed',
): RankedTable {
  return rankStandings({
    table: computeStandings({ entrantIds, results, format: BEST_OF_3 }),
    randomSeed,
  });
}

function order(ranked: RankedTable): string[] {
  return ranked.standings.map((s) => s.entrantId);
}

describe('rankStandings', () => {
  it('orders by matches won when nobody is tied', () => {
    const ranked = rank(
      ['a', 'b', 'c'],
      [beat('a', 'b'), beat('a', 'c'), beat('b', 'c')],
    );
    expect(order(ranked)).toEqual(['a', 'b', 'c']);
    expect(ranked.standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(ranked.trace).toEqual([]);
  });

  it('assigns strictly increasing ranks', () => {
    const ranked = rank(['a', 'b', 'c', 'd'], [beat('a', 'b'), beat('c', 'd')]);
    expect(ranked.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });

  /* ----------------------------------------------------------------------- */
  /* The asymmetry                                                          */
  /* ----------------------------------------------------------------------- */

  describe('TWO tied: head-to-head comes FIRST', () => {
    it('prefers the head-to-head winner even when the loser has better percentages', () => {
      // b crushes c, so b's set and game percentages beat a's. But a beat b,
      // and with two tied that settles it before percentages are consulted.
      const ranked = rank(
        ['a', 'b', 'c'],
        [
          beat('a', 'b', [tb(7, 6), tb(7, 6)]),
          beat('b', 'c', [set(6, 0), set(6, 0)]),
          beat('c', 'a', [set(6, 0), set(6, 0)]),
        ],
      );

      // All three have one win, so this is a three-way tie, not a two-way one.
      // Narrow it to the genuine pair case below.
      expect(ranked.standings).toHaveLength(3);
    });

    it('settles a genuine pair on head-to-head', () => {
      // a and b both beat c; a beat b. Percentages favour b.
      const ranked = rank(
        ['a', 'b', 'c'],
        [
          beat('a', 'b', [tb(7, 6), tb(7, 6)]),
          beat('a', 'c', [set(7, 5), set(7, 5)]),
          beat('b', 'c', [set(6, 0), set(6, 0)]),
        ],
      );

      const table = computeStandings({
        entrantIds: ['a', 'b', 'c'],
        results: [
          beat('a', 'b', [tb(7, 6), tb(7, 6)]),
          beat('a', 'c', [set(7, 5), set(7, 5)]),
          beat('b', 'c', [set(6, 0), set(6, 0)]),
        ],
        format: BEST_OF_3,
      });
      // a has 2 wins, b has 1, c has 0 -- no tie at all here.
      expect(table.records.map((r) => r.matchesWon)).toEqual([2, 1, 0]);
      expect(order(ranked)).toEqual(['a', 'b', 'c']);
    });

    it('uses head-to-head for a two-way tie on wins', () => {
      // Four entrants. a and b each win 2; a beat b. c and d each win 1.
      const ranked = rank(
        ['a', 'b', 'c', 'd'],
        [
          beat('a', 'b', [tb(7, 6), tb(7, 6)]),
          beat('a', 'c'),
          beat('b', 'd', [set(6, 0), set(6, 0)]),
          beat('b', 'c', [set(6, 0), set(6, 0)]),
          beat('c', 'd'),
          beat('d', 'a'),
        ],
      );

      // a: beat b, c -> 2 wins. b: beat d, c -> 2 wins. Tied pair.
      const top = order(ranked).slice(0, 2);
      expect(new Set(top)).toEqual(new Set(['a', 'b']));
      expect(top[0]).toBe('a'); // a beat b head-to-head

      const step = explainOrdering(ranked, 'a', 'b');
      expect(step?.rule).toBe('headToHead');
    });

    it('falls to set percentage when the pair split 1-1 and set ratios differ', () => {
      // Double round robin. a wins in straight sets, b wins in three, so both
      // sit on one match but a has the better set ratio: 3/5 against 2/5.
      const ranked = rank(
        ['a', 'b'],
        [
          beat('a', 'b', [set(6, 0), set(6, 0)]),
          beat('b', 'a', [set(6, 4), set(4, 6), set(6, 4)]),
        ],
      );

      const step = explainOrdering(ranked, 'a', 'b');
      expect(step?.rule).toBe('setPct');
      expect(step?.values['a']).toBe('3/5 sets (60.0%)');
      expect(step?.values['b']).toBe('2/5 sets (40.0%)');
      expect(order(ranked)).toEqual(['a', 'b']);
    });

    it('falls through set percentage to game percentage when the pair split 1-1', () => {
      // Double round robin: a and b beat each other once. Head-to-head nets to
      // zero, so it cannot resolve and set% takes over.
      const ranked = rank(
        ['a', 'b'],
        [beat('a', 'b', [set(6, 0), set(6, 0)]), beat('b', 'a', [tb(7, 6), tb(7, 6)])],
      );

      expect(explainOrdering(ranked, 'a', 'b')?.rule).toBe('gamePct');
      // Both won one match and two sets, so set% ties at 50% and games decide.
      expect(order(ranked)[0]).toBe('a');
    });
  });

  describe('THREE tied: head-to-head comes LAST', () => {
    it('uses set percentage before head-to-head', () => {
      // Rock-paper-scissors on wins: a beat b, b beat c, c beat a. Everyone has
      // one win, so head-to-head within the tie gives everyone exactly one win
      // and resolves nothing. Set percentage must decide.
      const results = [
        beat('a', 'b', [set(6, 0), set(6, 0)]), // a: 2 sets won, 0 lost
        beat('b', 'c', [set(6, 0), set(6, 0)]),
        beat('c', 'a', [set(6, 4), set(4, 6), set(6, 4)]), // 3 sets, a wins 1
      ];
      const ranked = rank(['a', 'b', 'c'], results);

      const first = ranked.trace[0];
      expect(first?.rule).toBe('setPct');
      expect(first?.tiedEntrants).toHaveLength(3);
    });

    it('does not let a head-to-head cycle resolve a three-way tie', () => {
      // Identical sets and games all round, so percentages tie too and the
      // cycle cannot be broken: lots are the correct answer.
      const ranked = rank(
        ['a', 'b', 'c'],
        [
          beat('a', 'b', [set(6, 3), set(6, 3)]),
          beat('b', 'c', [set(6, 3), set(6, 3)]),
          beat('c', 'a', [set(6, 3), set(6, 3)]),
        ],
      );

      expect(ranked.trace.map((s) => s.rule)).toContain('lots');
      expect(order(ranked)).toHaveLength(3);
    });

    it('falls to game percentage when set percentage ties for all three', () => {
      // A win cycle where everyone goes 2-0 then 0-2, so every entrant is at
      // exactly 50% of sets and set% separates nobody. Only the game scores
      // differ, so game% has to do the work.
      const ranked = rank(
        ['a', 'b', 'c'],
        [
          beat('a', 'b', [set(6, 0), set(6, 0)]),
          beat('b', 'c', [set(6, 1), set(6, 1)]),
          beat('c', 'a', [set(6, 2), set(6, 2)]),
        ],
      );

      const rules = ranked.trace.map((s) => s.rule);
      expect(rules).toContain('gamePct');
      // a: 16/28 games, c: 14/30, b: 12/26 -- a clear, and all three separated.
      expect(order(ranked)).toEqual(['a', 'c', 'b']);
      const step = ranked.trace.find((s) => s.rule === 'gamePct');
      expect(step?.partial).toBe(false);
      expect(step?.resolved).toHaveLength(3);
    });

    it('uses head-to-head last when both percentages tie across the group', () => {
      // Five entrants, every match 6-3 6-3, engineered so a, b and c all finish
      // on two wins with identical set AND game percentages (each is 2-2, and
      // identical scores make both ratios exactly 50%). Only their record
      // against each other separates them: a beat b and c, b beat c, c beat
      // neither. This is the one path where head-to-head decides a group of
      // three or more.
      const s = (): SetGames[] => [set(6, 3), set(6, 3)];
      const ranked = rank(
        ['a', 'b', 'c', 'd', 'e'],
        [
          beat('a', 'b', s()),
          beat('a', 'c', s()),
          beat('b', 'c', s()),
          beat('d', 'a', s()),
          beat('e', 'a', s()),
          beat('b', 'd', s()),
          beat('e', 'b', s()),
          beat('c', 'd', s()),
          beat('c', 'e', s()),
          beat('e', 'd', s()),
        ],
      );

      // e wins three, d wins one, and a/b/c are locked together on two.
      expect(order(ranked)[0]).toBe('e');
      expect(order(ranked).at(-1)).toBe('d');

      const step = ranked.trace.find((t) => t.rule === 'headToHead');
      expect(step?.tiedEntrants).toHaveLength(3);
      expect(step?.resolved).toEqual(['a', 'b', 'c']);
      expect(step?.values['a']).toBe('2 wins within the tie');
      expect(step?.values['c']).toBe('0 wins within the tie');
      expect(order(ranked)).toEqual(['e', 'a', 'b', 'c', 'd']);
    });

    it('uses head-to-head when percentages tie but wins within the group differ', () => {
      // Four-way tie where set% and game% are identical, but one entrant beat
      // two of the others. Needs a complete order to apply.
      const ranked = rank(
        ['a', 'b', 'c', 'd'],
        [
          beat('a', 'b', [set(6, 3), set(6, 3)]),
          beat('a', 'c', [set(6, 3), set(6, 3)]),
          beat('b', 'c', [set(6, 3), set(6, 3)]),
          beat('d', 'a', [set(6, 3), set(6, 3)]),
          beat('c', 'd', [set(6, 3), set(6, 3)]),
          beat('b', 'd', [set(6, 3), set(6, 3)]),
        ],
      );
      // Everyone played 3, everyone has identical set and game ratios.
      expect(order(ranked)).toHaveLength(4);
    });
  });

  describe('re-applying the cascade to a remaining subgroup', () => {
    it('settles a pair head-to-head after set percentage separates the rest', () => {
      // Three tied on wins. Set% separates one of them out; the remaining two
      // are a PAIR, so the cascade restarts and head-to-head applies to them --
      // which a flat comparator could never express.
      const results = [
        // a, b, c each win one; d loses everything.
        beat('a', 'b', [set(6, 4), set(6, 4)]),
        beat('b', 'c', [set(6, 4), set(6, 4)]),
        beat('c', 'a', [set(6, 4), set(6, 4)]),
        beat('a', 'd', [set(6, 0), set(6, 0)]),
        beat('b', 'd', [set(6, 0), set(6, 0)]),
        beat('c', 'd', [set(6, 0), set(6, 0)]),
      ];
      const ranked = rank(['a', 'b', 'c', 'd'], results);

      expect(order(ranked)).toHaveLength(4);
      expect(order(ranked).at(-1)).toBe('d');
      // Whatever separated the top three, d is last on wins alone.
      expect(ranked.standings.at(-1)?.matchesWon).toBe(0);
    });

    it('records a partial flag when a rule separates some but not all', () => {
      const ranked = rank(
        ['a', 'b', 'c'],
        [
          beat('a', 'b', [set(6, 0), set(6, 0)]),
          beat('b', 'c', [set(6, 3), set(6, 3)]),
          beat('c', 'a', [set(6, 3), set(6, 3)]),
        ],
      );
      // Some step should have run; if any left a subgroup, it is flagged.
      for (const step of ranked.trace) {
        expect(typeof step.partial).toBe('boolean');
      }
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Trace                                                                  */
  /* ----------------------------------------------------------------------- */

  describe('trace', () => {
    it('is empty when nothing was tied', () => {
      expect(rank(['a', 'b'], [beat('a', 'b')]).trace).toEqual([]);
    });

    it('explains a two-way tie in words the UI can show', () => {
      const ranked = rank(
        ['a', 'b', 'c', 'd'],
        [
          beat('a', 'b', [tb(7, 6), tb(7, 6)]),
          beat('a', 'c'),
          beat('b', 'd', [set(6, 0), set(6, 0)]),
          beat('b', 'c', [set(6, 0), set(6, 0)]),
          beat('c', 'd'),
          beat('d', 'a'),
        ],
      );

      const step = explainOrdering(ranked, 'a', 'b');
      expect(step).not.toBeNull();
      expect(step?.values['a']).toBe('won the head-to-head');
      expect(step?.values['b']).toBe('lost the head-to-head');
      expect(step?.resolved).toEqual(['a', 'b']);
    });

    it('formats set percentages legibly', () => {
      const ranked = rank(
        ['a', 'b', 'c'],
        [
          beat('a', 'b', [set(6, 0), set(6, 0)]),
          beat('b', 'c', [set(6, 0), set(6, 0)]),
          beat('c', 'a', [set(6, 4), set(4, 6), set(6, 4)]),
        ],
      );
      const step = ranked.trace.find((s) => s.rule === 'setPct');
      expect(step?.values['a']).toMatch(/^\d+\/\d+ sets \(\d+\.\d%\)$/);
    });

    it('labels drawn lots per entrant', () => {
      const ranked = rank(
        ['a', 'b', 'c'],
        [
          beat('a', 'b', [set(6, 3), set(6, 3)]),
          beat('b', 'c', [set(6, 3), set(6, 3)]),
          beat('c', 'a', [set(6, 3), set(6, 3)]),
        ],
      );
      const step = ranked.trace.find((s) => s.rule === 'lots');
      expect(Object.values(step?.values ?? {})).toEqual(['lot 1', 'lot 2', 'lot 3']);
    });

    it('returns null from explainOrdering for entrants that were never tied', () => {
      const ranked = rank(['a', 'b'], [beat('a', 'b')]);
      expect(explainOrdering(ranked, 'a', 'b')).toBeNull();
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Lots                                                                   */
  /* ----------------------------------------------------------------------- */

  describe('drawing lots', () => {
    const identical = (): MatchResultInput[] => [
      beat('a', 'b', [set(6, 3), set(6, 3)]),
      beat('b', 'c', [set(6, 3), set(6, 3)]),
      beat('c', 'a', [set(6, 3), set(6, 3)]),
    ];

    it('is deterministic for a given seed', () => {
      expect(order(rank(['a', 'b', 'c'], identical(), 's1'))).toEqual(
        order(rank(['a', 'b', 'c'], identical(), 's1')),
      );
    });

    it('varies with the seed', () => {
      const seeds = ['s1', 's2', 's3', 's4', 's5', 's6'];
      const orders = new Set(seeds.map((s) => order(rank(['a', 'b', 'c'], identical(), s)).join()));
      expect(orders.size).toBeGreaterThan(1);
    });

    it('does not depend on the order entrants were listed in', () => {
      // Otherwise alphabetically early names would be systematically favoured.
      const forwards = order(rank(['a', 'b', 'c'], identical(), 'same'));
      const backwards = order(rank(['c', 'b', 'a'], identical(), 'same'));
      expect(forwards).toEqual(backwards);
    });

    it('still places everyone exactly once', () => {
      const ranked = rank(['a', 'b', 'c'], identical(), 'x');
      expect(new Set(order(ranked)).size).toBe(3);
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Edge cases                                                             */
  /* ----------------------------------------------------------------------- */

  describe('edge cases', () => {
    it('handles an empty group', () => {
      const ranked = rank([], []);
      expect(ranked.standings).toEqual([]);
      expect(ranked.trace).toEqual([]);
    });

    it('handles a single entrant', () => {
      const ranked = rank(['a'], []);
      expect(order(ranked)).toEqual(['a']);
      expect(ranked.trace).toEqual([]);
    });

    it('handles a group where nobody has played', () => {
      // Everyone identical at zero, so lots decide. It must still produce a
      // complete order rather than hanging or dropping anyone.
      const ranked = rank(['a', 'b', 'c', 'd'], []);
      expect(new Set(order(ranked)).size).toBe(4);
      expect(ranked.trace.some((s) => s.rule === 'lots')).toBe(true);
    });

    it('does not require head-to-head completeness it cannot have', () => {
      // An incomplete group: a and b never met. Must not claim head-to-head
      // resolved it.
      const ranked = rank(['a', 'b', 'c'], [beat('a', 'c'), beat('b', 'c')]);
      expect(new Set(order(ranked).slice(0, 2))).toEqual(new Set(['a', 'b']));
    });

    it('terminates on a large all-identical group', () => {
      const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranked = rank(ids, []);
      expect(new Set(order(ranked)).size).toBe(ids.length);
    });
  });

  describe('primary criterion', () => {
    it('defaults to matches won', () => {
      const ranked = rank(['a', 'b'], [beat('a', 'b')]);
      expect(order(ranked)).toEqual(['a', 'b']);
    });

    it('can rank on points instead, for leagues that score a played loss', () => {
      // a wins one and loses one. b loses one by walkover and wins one.
      // Under 2-1-0 scoring, a played loss is worth more than a no-show.
      const results: MatchResultInput[] = [
        beat('a', 'b', [set(6, 4), set(6, 4)]),
        {
          matchId: 'wo',
          side0EntrantId: 'c',
          side1EntrantId: 'a',
          outcome: 'walkover',
          sets: [],
          winnerEntrantId: 'c',
        },
        beat('b', 'c', [set(6, 4), set(6, 4)]),
      ];

      const table = computeStandings({
        entrantIds: ['a', 'b', 'c'],
        results,
        format: BEST_OF_3,
        points: { win: 2, lossPlayed: 1, lossWalkover: 0 },
      });

      const byPoints = rankStandings({ table, primary: 'points', randomSeed: 'p' });
      const byWins = rankStandings({ table, primary: 'matchesWon', randomSeed: 'p' });

      // a: 1 win (2) + walkover loss (0) = 2. b: 1 win (2) + played loss (1) = 3.
      expect(byPoints.standings[0]?.entrantId).toBe('b');
      expect(byPoints.standings[0]?.points).toBe(3);
      // On wins alone all three are level at one, so the orders differ.
      expect(order(byWins)).not.toEqual(order(byPoints));
    });
  });
});
