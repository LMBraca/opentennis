import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import {
  MAX_ROUND_ROBIN_SIZE,
  circleRounds,
  generateRoundRobin,
  roundRobinMatchCount,
} from './round-robin';
import { fullySeeded, partiallySeeded, unseeded } from './testing/fixtures';
import type { Entrant, GeneratedStage } from './types';

const SEED = 'round-robin-2026';

function gen(entrants: readonly Entrant[], double = false): GeneratedStage {
  return generateRoundRobin({ entrants, randomSeed: SEED, doubleRoundRobin: double });
}

function allMatches(stage: GeneratedStage) {
  return stage.rounds.flatMap((r) => r.matches);
}

/** Unordered pair key, so A-v-B and B-v-A compare equal. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function pairKeysOf(stage: GeneratedStage): string[] {
  return allMatches(stage).map((m) =>
    pairKey(m.sides[0].entrantId as string, m.sides[1].entrantId as string),
  );
}

const FIELD_SIZES = Array.from({ length: MAX_ROUND_ROBIN_SIZE - 1 }, (_, i) => i + 2);

describe('circleRounds', () => {
  it('schedules an even field in n-1 rounds with nobody idle', () => {
    const rounds = circleRounds(['a', 'b', 'c', 'd']);
    expect(rounds).toHaveLength(3);
    for (const round of rounds) {
      expect(round.pairs).toHaveLength(2);
      expect(round.idle).toEqual([]);
    }
  });

  it('schedules an odd field in n rounds with exactly one idle each', () => {
    const rounds = circleRounds(['a', 'b', 'c']);
    expect(rounds).toHaveLength(3);
    for (const round of rounds) {
      expect(round.pairs).toHaveLength(1);
      expect(round.idle).toHaveLength(1);
    }
  });

  it('pairs every combination exactly once', () => {
    for (const n of FIELD_SIZES) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const keys = circleRounds(ids).flatMap((r) => r.pairs.map(([a, b]) => pairKey(a, b)));

      expect(keys, `n=${n}`).toHaveLength(roundRobinMatchCount(n));
      expect(new Set(keys).size, `n=${n}`).toBe(roundRobinMatchCount(n));
    }
  });

  it('never schedules an entrant twice in the same round', () => {
    for (const n of FIELD_SIZES) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      for (const round of circleRounds(ids)) {
        const playing = round.pairs.flatMap(([a, b]) => [a, b]);
        expect(new Set(playing).size, `n=${n}`).toBe(playing.length);
      }
    }
  });

  it('gives every entrant equal rest in an odd field', () => {
    for (const n of FIELD_SIZES.filter((x) => x % 2 === 1)) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const idleCounts = new Map<string, number>(ids.map((id) => [id, 0]));
      for (const round of circleRounds(ids)) {
        for (const id of round.idle) idleCounts.set(id, (idleCounts.get(id) ?? 0) + 1);
      }
      // Each entrant sits out exactly once per cycle.
      for (const [id, count] of idleCounts) expect(count, `n=${n} ${id}`).toBe(1);
    }
  });

  it('has every entrant play in every round of an even field', () => {
    for (const n of FIELD_SIZES.filter((x) => x % 2 === 0)) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      for (const round of circleRounds(ids)) {
        expect(round.pairs.flatMap(([a, b]) => [a, b]).sort()).toEqual([...ids].sort());
      }
    }
  });

  it('handles the smallest field', () => {
    const rounds = circleRounds(['a', 'b']);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.pairs).toEqual([['a', 'b']]);
  });
});

describe('generateRoundRobin', () => {
  describe('structure', () => {
    it('produces a round-robin stage with one group', () => {
      const stage = gen(unseeded(6));
      expect(stage.kind).toBe('roundRobin');
      expect(stage.groups).toHaveLength(1);
      expect(stage.groups[0]?.entrantIds).toHaveLength(6);
    });

    it('names rounds numerically, not by distance to a final', () => {
      // There is no final in a round robin; "Semifinal" would be nonsense.
      expect(gen(unseeded(6)).rounds.map((r) => r.name)).toEqual([
        'Round 1',
        'Round 2',
        'Round 3',
        'Round 4',
        'Round 5',
      ]);
    });

    it('attributes every match to its group', () => {
      for (const match of allMatches(gen(unseeded(5)))) {
        expect(match.groupId).toBe('g1');
      }
    });

    it('leaves every side resolved — a round robin has no feeders', () => {
      for (const match of allMatches(gen(unseeded(7)))) {
        for (const side of match.sides) {
          expect(side.entrantId).not.toBeNull();
          expect(side.sourceRef).toBeNull();
        }
      }
    });

    it('marks no byes, because sitting out a round is not a bye', () => {
      // Conflating the two would corrupt standings percentages.
      const stage = gen(unseeded(5));
      expect(stage.meta.byeCount).toBe(0);
      expect(stage.meta.byeRecipients).toEqual([]);
      expect(stage.meta.bracketSize).toBeNull();
      expect(allMatches(stage).every((m) => m.status === 'pending')).toBe(true);
    });

    it('gives every match a unique id that cannot collide with a bracket id', () => {
      const ids = allMatches(gen(unseeded(8))).map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      // Group-prefixed, so "g1r0m0" rather than the bracket's "r0m0".
      for (const id of ids) expect(id.startsWith('g1r')).toBe(true);
    });
  });

  describe('completeness sweep, 2..12 entrants', () => {
    it('schedules every pair exactly once', () => {
      for (const n of FIELD_SIZES) {
        const keys = pairKeysOf(gen(unseeded(n)));
        expect(keys, `n=${n}`).toHaveLength(roundRobinMatchCount(n));
        expect(new Set(keys).size, `n=${n}`).toBe(roundRobinMatchCount(n));
      }
    });

    it('produces the right round count', () => {
      for (const n of FIELD_SIZES) {
        const expected = n % 2 === 0 ? n - 1 : n;
        expect(gen(unseeded(n)).rounds.length, `n=${n}`).toBe(expected);
      }
    });

    it('never schedules an entrant twice in a round', () => {
      for (const n of FIELD_SIZES) {
        for (const round of gen(unseeded(n)).rounds) {
          const playing = round.matches.flatMap((m) => m.sides.map((s) => s.entrantId));
          expect(new Set(playing).size, `n=${n}`).toBe(playing.length);
        }
      }
    });

    it('gives every entrant exactly n-1 matches', () => {
      for (const n of FIELD_SIZES) {
        const played = new Map<string, number>();
        for (const match of allMatches(gen(unseeded(n)))) {
          for (const side of match.sides) {
            const id = side.entrantId as string;
            played.set(id, (played.get(id) ?? 0) + 1);
          }
        }
        expect(played.size, `n=${n}`).toBe(n);
        for (const [id, count] of played) expect(count, `n=${n} ${id}`).toBe(n - 1);
      }
    });

    it('never pairs an entrant with itself', () => {
      for (const n of FIELD_SIZES) {
        for (const match of allMatches(gen(unseeded(n)))) {
          expect(match.sides[0].entrantId).not.toBe(match.sides[1].entrantId);
        }
      }
    });
  });

  describe('idle entrants', () => {
    it('records who sits out each round of an odd field', () => {
      const stage = gen(unseeded(5));
      for (const round of stage.rounds) {
        expect(round.idleEntrantIds).toHaveLength(1);
      }
      // Across the cycle, everyone rests exactly once.
      const rested = stage.rounds.flatMap((r) => r.idleEntrantIds ?? []);
      expect(new Set(rested).size).toBe(5);
    });

    it('omits the field entirely for an even draw', () => {
      for (const round of gen(unseeded(6)).rounds) {
        expect(round.idleEntrantIds).toBeUndefined();
      }
    });
  });

  describe('double round robin', () => {
    it('schedules every pair exactly twice', () => {
      for (const n of FIELD_SIZES) {
        const keys = pairKeysOf(gen(unseeded(n), true));
        expect(keys, `n=${n}`).toHaveLength(roundRobinMatchCount(n, true));
        const counts = new Map<string, number>();
        for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
        for (const [k, c] of counts) expect(c, `n=${n} ${k}`).toBe(2);
      }
    });

    it('swaps sides on the second meeting, so each is listed first once', () => {
      const stage = gen(unseeded(4), true);
      const ordered = allMatches(stage).map(
        (m) => `${m.sides[0].entrantId}>${m.sides[1].entrantId}`,
      );
      // Every directed pairing appears exactly once across both cycles.
      expect(new Set(ordered).size).toBe(ordered.length);
    });

    it('doubles the round count', () => {
      for (const n of FIELD_SIZES) {
        const single = gen(unseeded(n)).rounds.length;
        expect(gen(unseeded(n), true).rounds.length, `n=${n}`).toBe(single * 2);
      }
    });

    it('keeps round numbering continuous across both cycles', () => {
      const names = gen(unseeded(4), true).rounds.map((r) => r.name);
      expect(names).toEqual(['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Round 6']);
    });
  });

  describe('seeding', () => {
    it('reports the seeding mode but does not let it change the pairings', () => {
      // Everyone plays everyone, so seeds cannot affect who meets whom. Worth
      // asserting because an admin might reasonably expect otherwise.
      const seeded = gen(fullySeeded(6));
      expect(seeded.meta.seedingMode).toBe('seeded');
      expect(new Set(pairKeysOf(seeded))).toEqual(new Set(pairKeysOf(gen(unseeded(6)))));
    });

    it('reports all three seeding modes', () => {
      expect(gen(unseeded(6)).meta.seedingMode).toBe('unseeded');
      expect(gen(partiallySeeded(6, 2)).meta.seedingMode).toBe('partial');
      expect(gen(fullySeeded(6)).meta.seedingMode).toBe('seeded');
    });

    it('counts the seeds it was given', () => {
      expect(gen(partiallySeeded(8, 3)).meta.seededCount).toBe(3);
    });
  });

  describe('determinism', () => {
    it('produces identical output for the same seed', () => {
      const field = unseeded(7);
      expect(JSON.stringify(gen(field))).toBe(JSON.stringify(gen(field)));
    });

    it('varies the schedule with the seed, while keeping the same pair set', () => {
      const field = unseeded(8);
      const a = generateRoundRobin({ entrants: field, randomSeed: 'a' });
      const b = generateRoundRobin({ entrants: field, randomSeed: 'b' });

      expect(JSON.stringify(a.rounds)).not.toBe(JSON.stringify(b.rounds));
      expect(new Set(pairKeysOf(a))).toEqual(new Set(pairKeysOf(b)));
    });

    it('does not depend on the order entrants were typed in', () => {
      const forwards = unseeded(6);
      const backwards = [...forwards].reverse();
      // Same pair set regardless of input order; the schedule is drawn, not listed.
      expect(new Set(pairKeysOf(gen(forwards)))).toEqual(new Set(pairKeysOf(gen(backwards))));
    });
  });

  describe('withdrawals', () => {
    it('excludes non-active entrants', () => {
      const entrants: Entrant[] = [
        ...unseeded(4),
        { id: 'gone', seed: null, status: 'withdrawn' },
        { id: 'absent', seed: null, status: 'noShow' },
      ];
      const stage = generateRoundRobin({ entrants, randomSeed: SEED });

      expect(stage.meta.entrantCount).toBe(4);
      expect(allMatches(stage)).toHaveLength(6);
      const ids = new Set(allMatches(stage).flatMap((m) => m.sides.map((s) => s.entrantId)));
      expect(ids.has('gone')).toBe(false);
      expect(ids.has('absent')).toBe(false);
    });
  });

  describe('validation', () => {
    it('rejects fewer than two entrants', () => {
      expect(() => gen(unseeded(1))).toThrow(/at least 2/);
      expect(() => gen([])).toThrow(EngineError);
    });

    it('points at groups rather than generating an unplayable schedule', () => {
      expect(() => gen(unseeded(13))).toThrow(/use groups instead/);
      try {
        gen(unseeded(20));
      } catch (e) {
        expect((e as EngineError).code).toBe('TOO_MANY_ENTRANTS');
      }
    });

    it('rejects duplicate entrant ids', () => {
      const entrants: Entrant[] = [
        { id: 'x', seed: null, status: 'active' },
        { id: 'x', seed: null, status: 'active' },
      ];
      expect(() => generateRoundRobin({ entrants, randomSeed: SEED })).toThrow(
        /appears more than once/,
      );
    });
  });

  describe('meta.description', () => {
    it('states match and round counts for an even field', () => {
      expect(gen(unseeded(6)).meta.description).toBe(
        'Round robin of 6 entrants — 15 matches across 5 rounds.',
      );
    });

    it('mentions the rest round for an odd field', () => {
      expect(gen(unseeded(5)).meta.description).toBe(
        'Round robin of 5 entrants — 10 matches across 5 rounds; each entrant sits out one round per cycle.',
      );
    });

    it('says when it is a double round robin', () => {
      expect(gen(unseeded(4), true).meta.description).toBe(
        'Double round robin of 4 entrants — 12 matches across 6 rounds.',
      );
    });

    it('uses singulars for a two-entrant field', () => {
      expect(gen(unseeded(2)).meta.description).toBe(
        'Round robin of 2 entrants — 1 match across 1 round.',
      );
    });
  });

  describe('custom group identity', () => {
    it('accepts an id and a numbered name, for use by the hybrid format', () => {
      const stage = generateRoundRobin({
        entrants: unseeded(4),
        randomSeed: SEED,
        groupId: 'g3',
        groupName: 'Group 3',
      });
      expect(stage.groups[0]?.id).toBe('g3');
      expect(stage.groups[0]?.name).toBe('Group 3');
      expect(allMatches(stage).every((m) => m.groupId === 'g3')).toBe(true);
      expect(allMatches(stage).every((m) => m.id.startsWith('g3r'))).toBe(true);
    });
  });
});

describe('roundRobinMatchCount', () => {
  it('matches n(n-1)/2', () => {
    expect(roundRobinMatchCount(2)).toBe(1);
    expect(roundRobinMatchCount(4)).toBe(6);
    expect(roundRobinMatchCount(6)).toBe(15);
    expect(roundRobinMatchCount(12)).toBe(66);
  });

  it('doubles when asked', () => {
    expect(roundRobinMatchCount(4, true)).toBe(12);
    expect(roundRobinMatchCount(12, true)).toBe(132);
  });
});
