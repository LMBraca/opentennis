import { describe, expect, it } from 'vitest';
import { BEST_OF_3, type SetGames } from './scoring';
import { computeStandings, recordFor, type MatchResultInput } from './standings';
import { applyWithdrawals } from './withdrawals';

function set(a: number, b: number): SetGames {
  return { side0Games: a, side1Games: b, side0TiebreakPoints: null, side1TiebreakPoints: null };
}

const STRAIGHT: SetGames[] = [set(6, 2), set(6, 2)];

function beat(winner: string, loser: string): MatchResultInput {
  return {
    matchId: `${winner}-${loser}`,
    side0EntrantId: winner,
    side1EntrantId: loser,
    outcome: 'completed',
    sets: STRAIGHT,
    winnerEntrantId: winner,
  };
}

const GROUP = ['a', 'b', 'c', 'd', 'e']; // five entrants, four matches each

describe('applyWithdrawals', () => {
  it('does nothing when nobody withdrew', () => {
    const out = applyWithdrawals({
      entrantIds: GROUP,
      withdrawnEntrantIds: [],
      results: [beat('a', 'b')],
    });

    expect(out.adjusted).toBe(false);
    expect(out.adjustments).toEqual([]);
    expect(out.entrantIds).toEqual(GROUP);
    expect(out.results).toHaveLength(1);
  });

  describe('fewer than half completed — expunged', () => {
    it('removes the entrant and every result involving them', () => {
      // e played 1 of 4. One is fewer than half, so e is erased.
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('a', 'b'), beat('c', 'd'), beat('e', 'a')],
      });

      expect(out.entrantIds).toEqual(['a', 'b', 'c', 'd']);
      expect(out.results.map((r) => r.matchId)).toEqual(['a-b', 'c-d']);
      expect(out.adjustments[0]).toMatchObject({
        entrantId: 'e',
        action: 'expunged',
        completedMatches: 1,
        scheduledMatches: 4,
        walkoversAwarded: [],
      });
    });

    it("takes back the win an opponent had already banked", () => {
      // This is the point of the rule: a's win over e disappears, because one
      // free result from a quitter distorts the group.
      const results = [beat('a', 'e'), beat('a', 'b')];
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results,
      });

      const table = computeStandings({
        entrantIds: out.entrantIds,
        results: out.results,
        format: BEST_OF_3,
      });
      expect(recordFor(table, 'a').matchesWon).toBe(1);
    });

    it('explains itself in words', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a')],
      });
      expect(out.adjustments[0]?.reason).toBe(
        'Withdrew after 1 of 4 matches — fewer than half, so all results involving this entrant were removed from the standings.',
      );
    });

    it('expunges an entrant who played nothing at all', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('a', 'b')],
      });
      expect(out.entrantIds).not.toContain('e');
      expect(out.adjustments[0]?.completedMatches).toBe(0);
    });
  });

  describe('half or more completed — results stand', () => {
    it('keeps their results and walks over the rest', () => {
      // e played 2 of 4. Exactly half, so the results stand.
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('b', 'e')],
      });

      expect(out.entrantIds).toEqual(GROUP);
      expect(out.adjustments[0]).toMatchObject({
        entrantId: 'e',
        action: 'resultsStand',
        completedMatches: 2,
      });
      // c and d never played e, so each gets a walkover.
      expect([...(out.adjustments[0]?.walkoversAwarded ?? [])].sort()).toEqual(['c', 'd']);
    });

    it('awards the walkover TO the opponent, not the quitter', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('b', 'e')],
      });

      const table = computeStandings({
        entrantIds: out.entrantIds,
        results: out.results,
        format: BEST_OF_3,
      });

      expect(recordFor(table, 'c').matchesWon).toBe(1);
      expect(recordFor(table, 'd').matchesWon).toBe(1);
      // And those walkovers contribute no games, per ENG-15.
      expect(recordFor(table, 'c').gamesWon).toBe(0);
      expect(recordFor(table, 'e').matchesLost).toBe(3); // b, plus c and d by w/o
    });

    it('keeps the win the quitter had legitimately earned', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('b', 'e')],
      });

      const table = computeStandings({
        entrantIds: out.entrantIds,
        results: out.results,
        format: BEST_OF_3,
      });
      expect(recordFor(table, 'e').matchesWon).toBe(1);
      expect(recordFor(table, 'a').matchesLost).toBe(1);
    });

    it('explains itself in words, with correct plurals', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('b', 'e')],
      });
      expect(out.adjustments[0]?.reason).toBe(
        'Withdrew after 2 of 4 matches — half or more, so completed results stand and the remaining 2 matches were recorded as walkovers.',
      );
    });

    it('uses the singular for a single remaining match', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('b', 'e'), beat('c', 'e')],
      });
      expect(out.adjustments[0]?.reason).toContain('remaining 1 match was recorded as a walkover');
    });
  });

  describe('the threshold', () => {
    it('treats exactly half as standing, not expunged', () => {
      // Four scheduled, two played. 2 * 2 === 4, so not "fewer than half".
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('e', 'b')],
      });
      expect(out.adjustments[0]?.action).toBe('resultsStand');
    });

    it('treats one short of half as expunged', () => {
      // Six entrants: five scheduled. Two played is fewer than 2.5.
      const six = [...GROUP, 'f'];
      const out = applyWithdrawals({
        entrantIds: six,
        withdrawnEntrantIds: ['f'],
        results: [beat('f', 'a'), beat('f', 'b')],
      });
      expect(out.adjustments[0]?.action).toBe('expunged');
      expect(out.adjustments[0]?.scheduledMatches).toBe(5);
    });

    it('doubles the scheduled count for a double round robin', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('b', 'e'), beat('e', 'c'), beat('d', 'e')],
        doubleRoundRobin: true,
      });
      expect(out.adjustments[0]?.scheduledMatches).toBe(8);
      // Four of eight is exactly half, so results stand.
      expect(out.adjustments[0]?.action).toBe('resultsStand');
      // Each opponent owes one more meeting.
      expect([...(out.adjustments[0]?.walkoversAwarded ?? [])].sort()).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('unfinished matches', () => {
    it('do not count towards the completed total', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [
          beat('e', 'a'),
          beat('e', 'b'),
          { ...beat('e', 'c'), outcome: 'unfinished', winnerEntrantId: null },
        ],
      });
      expect(out.adjustments[0]?.completedMatches).toBe(2);
    });

    it('are stripped from the output entirely', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: [],
        results: [beat('a', 'b'), { ...beat('c', 'd'), outcome: 'unfinished', winnerEntrantId: null }],
      });
      expect(out.results.map((r) => r.matchId)).toEqual(['a-b']);
    });
  });

  describe('multiple withdrawals', () => {
    it('handles one expunged and one standing', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['d', 'e'],
        results: [
          beat('e', 'a'),
          beat('b', 'e'), // e: 2 of 4 -> stands
          beat('d', 'a'), // d: 1 of 4 -> expunged
        ],
      });

      const actions = new Map(out.adjustments.map((a) => [a.entrantId, a.action]));
      expect(actions.get('e')).toBe('resultsStand');
      expect(actions.get('d')).toBe('expunged');
      expect(out.entrantIds).toEqual(['a', 'b', 'c', 'e']);
    });

    it('does not manufacture a walkover between two withdrawn entrants', () => {
      // Otherwise whichever is processed second awards one in reverse, and both
      // would be credited with beating the other.
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['d', 'e'],
        results: [
          beat('d', 'a'),
          beat('d', 'b'),
          beat('e', 'a'),
          beat('e', 'b'),
        ],
      });

      const between = out.results.filter(
        (r) =>
          (r.side0EntrantId === 'd' && r.side1EntrantId === 'e') ||
          (r.side0EntrantId === 'e' && r.side1EntrantId === 'd'),
      );
      expect(between).toEqual([]);
    });

    it('produces a standings table that still balances', () => {
      const out = applyWithdrawals({
        entrantIds: GROUP,
        withdrawnEntrantIds: ['e'],
        results: [beat('e', 'a'), beat('b', 'e'), beat('a', 'b'), beat('c', 'd')],
      });

      const table = computeStandings({
        entrantIds: out.entrantIds,
        results: out.results,
        format: BEST_OF_3,
      });

      const wins = table.records.reduce((s, r) => s + r.matchesWon, 0);
      const losses = table.records.reduce((s, r) => s + r.matchesLost, 0);
      expect(wins).toBe(losses);
      expect(wins).toBe(out.results.length);
    });
  });

  describe('validation', () => {
    it('rejects a withdrawn entrant who is not in the group', () => {
      expect(() =>
        applyWithdrawals({
          entrantIds: GROUP,
          withdrawnEntrantIds: ['zzz'],
          results: [],
        }),
      ).toThrow(/not in the group/);
    });
  });

  it('is idempotent on an already-adjusted result set', () => {
    const once = applyWithdrawals({
      entrantIds: GROUP,
      withdrawnEntrantIds: ['e'],
      results: [beat('e', 'a'), beat('b', 'e')],
    });
    const twice = applyWithdrawals({
      entrantIds: once.entrantIds,
      withdrawnEntrantIds: ['e'],
      results: once.results,
    });
    // The walkovers already exist, so no new ones are created.
    expect(twice.results).toHaveLength(once.results.length);
  });
});
