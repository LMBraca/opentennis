import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import {
  generateHybrid,
  groupIdFor,
  groupNameFor,
  rankAcrossGroups,
  snakeAssign,
  type HybridResult,
} from './hybrid';
import { fullySeeded, partiallySeeded, unseeded } from './testing/fixtures';
import type { Entrant, GeneratedStage, SourceRef } from './types';

const SEED = 'hybrid-2026';

function gen(
  entrants: readonly Entrant[],
  groupCount: number,
  qualifiersPerGroup: number,
): HybridResult {
  return generateHybrid({ entrants, randomSeed: SEED, groupCount, qualifiersPerGroup });
}

function playoffOpeners(stage: GeneratedStage): Array<[SourceRef | null, SourceRef | null]> {
  const round = stage.rounds.find((r) => r.kind === 'main' && r.index === 0);
  return (round?.matches ?? []).map((m) => [m.sides[0].sourceRef, m.sides[1].sourceRef]);
}

function label(ref: SourceRef | null): string {
  if (ref === null) return '-';
  if (ref.kind === 'groupRank') return `${ref.groupId}:${ref.rank}`;
  return ref.kind;
}

describe('snakeAssign', () => {
  it('distributes left-to-right then right-to-left', () => {
    // The published example: 4 groups, 12 entrants.
    const groups = snakeAssign([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 4);
    expect(groups[0]).toEqual([1, 8, 9]);
    expect(groups[1]).toEqual([2, 7, 10]);
    expect(groups[2]).toEqual([3, 6, 11]);
    expect(groups[3]).toEqual([4, 5, 12]);
  });

  it('keeps group sizes within one of each other', () => {
    for (let n = 4; n <= 40; n++) {
      for (let g = 2; g <= Math.floor(n / 2); g++) {
        const sizes = snakeAssign(Array.from({ length: n }, (_, i) => i), g).map((x) => x.length);
        expect(Math.max(...sizes) - Math.min(...sizes), `n=${n} g=${g}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('loses nobody', () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    expect(snakeAssign(items, 4).flat().sort((a, b) => a - b)).toEqual(items);
  });

  it('handles a single group', () => {
    expect(snakeAssign([1, 2, 3], 1)).toEqual([[1, 2, 3]]);
  });
});

describe('group naming', () => {
  it('numbers pools rather than lettering them', () => {
    // A/B/C+/C/D are skill categories. "Group B of the C+ draw" versus "the B
    // draw" is how a player ends up on the wrong court.
    expect(groupNameFor(0)).toBe('Group 1');
    expect(groupNameFor(3)).toBe('Group 4');
    expect(groupIdFor(0)).toBe('g1');
  });
});

describe('generateHybrid — group stage', () => {
  it('builds the requested number of pools', () => {
    const out = gen(unseeded(16), 4, 2);
    expect(out.groups).toHaveLength(4);
    expect(out.groups.map((g) => g.name)).toEqual(['Group 1', 'Group 2', 'Group 3', 'Group 4']);
  });

  it('places every entrant in exactly one pool', () => {
    for (const n of [8, 12, 15, 16, 20, 23]) {
      const out = gen(unseeded(n), 4, 1);
      const assigned = out.groups.flatMap((g) => [...g.entrantIds]);
      expect(assigned, `n=${n}`).toHaveLength(n);
      expect(new Set(assigned).size, `n=${n}`).toBe(n);
    }
  });

  it('snake-seeds the seeded portion across pools', () => {
    // Top four seeds must land in four different groups.
    const out = gen(fullySeeded(16), 4, 2);
    const groupOf = new Map<string, string>();
    for (const g of out.groups) for (const id of g.entrantIds) groupOf.set(id, g.id);
    const top = ['e1', 'e2', 'e3', 'e4'].map((id) => groupOf.get(id));
    expect(new Set(top).size).toBe(4);
  });

  it('attributes every group match to its pool', () => {
    const out = gen(unseeded(12), 3, 2);
    for (const round of out.groupStage.rounds) {
      expect(round.groupId).toBeDefined();
      for (const match of round.matches) expect(match.groupId).toBe(round.groupId);
    }
  });

  it('flags uneven pools, because percentages stop being comparable', () => {
    expect(gen(unseeded(16), 4, 2).unevenGroups).toBe(false);
    expect(gen(unseeded(15), 4, 2).unevenGroups).toBe(true);
  });

  it('describes the shape in words', () => {
    expect(gen(unseeded(16), 4, 2).description).toBe(
      '16 entrants in 4 groups of 4/4/4/4; top 2 advance to an 8-qualifier playoff.',
    );
  });

  it('works from a target group size instead of a count', () => {
    const out = generateHybrid({
      entrants: unseeded(16),
      randomSeed: SEED,
      targetGroupSize: 4,
      qualifiersPerGroup: 2,
    });
    expect(out.groups).toHaveLength(4);
  });
});

describe('generateHybrid — playoff', () => {
  it('references group positions, not entrants', () => {
    // The whole bracket must be renderable before any group finishes.
    const out = gen(unseeded(16), 4, 2);
    for (const [left, right] of playoffOpeners(out.playoffStage)) {
      for (const ref of [left, right]) {
        expect(ref?.kind).toBe('groupRank');
      }
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
    }
  });

  it('leaves every playoff side unresolved at generation time', () => {
    const out = gen(unseeded(12), 3, 2);
    for (const round of out.playoffStage.rounds) {
      for (const match of round.matches) {
        for (const side of match.sides) expect(side.entrantId).toBeNull();
      }
    }
  });

  it('matches the published pairing for 2 groups and 2 qualifiers', () => {
    const out = gen(unseeded(8), 2, 2);
    const pairs = playoffOpeners(out.playoffStage).map(([a, b]) => `${label(a)} v ${label(b)}`);
    expect(pairs).toEqual(['g1:1 v g2:2', 'g2:1 v g1:2']);
  });

  it('matches the published pairing for 4 groups and 2 qualifiers', () => {
    const out = gen(unseeded(16), 4, 2);
    const pairs = playoffOpeners(out.playoffStage).map(([a, b]) => `${label(a)} v ${label(b)}`);
    expect(new Set(pairs)).toEqual(
      new Set(['g1:1 v g4:2', 'g4:1 v g1:2', 'g2:1 v g3:2', 'g3:1 v g2:2']),
    );
  });

  it('never opens with two entrants from the same pool, for even group counts', () => {
    for (const groupCount of [2, 4, 6, 8]) {
      for (const qualifiers of [1, 2]) {
        const out = gen(unseeded(groupCount * 4), groupCount, qualifiers);
        expect(out.sameGroupRematch, `g=${groupCount} q=${qualifiers}`).toBe(false);
      }
    }
  });

  it('avoids a same-pool opener for odd group counts by rotating the lower tiers', () => {
    // Three groups with two qualifiers gives six, which in an eight-bracket
    // would naively put G3's winner against G3's runner-up in round one.
    for (const groupCount of [3, 5, 7]) {
      const out = gen(unseeded(groupCount * 4), groupCount, 2);
      expect(out.sameGroupRematch, `g=${groupCount}`).toBe(false);
    }
  });

  it('inherits byes when the qualifier count is not a power of two', () => {
    // 3 groups x 2 qualifiers = 6 in an 8-bracket, so two byes.
    const out = gen(unseeded(12), 3, 2);
    expect(out.playoffStage.meta.bracketSize).toBe(8);
    expect(out.playoffStage.meta.byeCount).toBe(2);
  });

  it('can add a third-place playoff', () => {
    const out = generateHybrid({
      entrants: unseeded(16),
      randomSeed: SEED,
      groupCount: 4,
      qualifiersPerGroup: 2,
      thirdPlacePlayoff: true,
    });
    expect(out.playoffStage.rounds.some((r) => r.kind === 'thirdPlace')).toBe(true);
  });

  it('takes a single qualifier per group when asked', () => {
    const out = gen(unseeded(16), 4, 1);
    const pairs = playoffOpeners(out.playoffStage).map(([a, b]) => `${label(a)} v ${label(b)}`);
    expect(pairs).toEqual(['g1:1 v g4:1', 'g2:1 v g3:1']);
  });
});

describe('generateHybrid — determinism', () => {
  it('is stable for a given seed', () => {
    expect(JSON.stringify(gen(unseeded(20), 4, 2))).toBe(JSON.stringify(gen(unseeded(20), 4, 2)));
  });

  it('varies group membership with the seed', () => {
    const a = generateHybrid({
      entrants: unseeded(20),
      randomSeed: 'a',
      groupCount: 4,
      qualifiersPerGroup: 2,
    });
    const b = generateHybrid({
      entrants: unseeded(20),
      randomSeed: 'b',
      groupCount: 4,
      qualifiersPerGroup: 2,
    });
    expect(JSON.stringify(a.groups)).not.toBe(JSON.stringify(b.groups));
  });

  it('handles a partially seeded field', () => {
    const out = gen(partiallySeeded(16, 4), 4, 2);
    expect(out.groupStage.meta.seedingMode).toBe('partial');
    expect(out.groups).toHaveLength(4);
  });
});

describe('generateHybrid — validation', () => {
  it('rejects both groupCount and targetGroupSize', () => {
    expect(() =>
      generateHybrid({
        entrants: unseeded(16),
        randomSeed: SEED,
        groupCount: 4,
        targetGroupSize: 4,
        qualifiersPerGroup: 2,
      }),
    ).toThrow(/not both/);
  });

  it('requires one of them', () => {
    expect(() =>
      generateHybrid({ entrants: unseeded(16), randomSeed: SEED, qualifiersPerGroup: 2 }),
    ).toThrow(/is required/);
  });

  it('rejects more groups than the field can fill with pairs', () => {
    expect(() => gen(unseeded(5), 4, 1)).toThrow(/at least 8 entrants/);
  });

  it('rejects taking more qualifiers than a group contains', () => {
    expect(() => gen(unseeded(8), 4, 3)).toThrow(/Cannot take 3 qualifiers/);
  });

  it('rejects a non-positive qualifier count', () => {
    expect(() => gen(unseeded(8), 2, 0)).toThrow(EngineError);
  });

  it('rejects a non-positive or fractional group count', () => {
    expect(() => gen(unseeded(8), 0, 1)).toThrow(/positive integer/);
    expect(() => gen(unseeded(8), 2.5, 1)).toThrow(/positive integer/);
  });

  it('rejects a target group size below two', () => {
    expect(() =>
      generateHybrid({
        entrants: unseeded(8),
        randomSeed: SEED,
        targetGroupSize: 1,
        qualifiersPerGroup: 1,
      }),
    ).toThrow(/at least 2/);
  });
});

describe('rankAcrossGroups', () => {
  function rankedOf(ids: string[]) {
    return {
      standings: ids.map((entrantId, i) => ({
        entrantId,
        rank: i + 1,
        matchesPlayed: ids.length - 1,
        matchesWon: ids.length - 1 - i,
        matchesLost: i,
        setsWon: (ids.length - 1 - i) * 2,
        setsLost: i * 2,
        gamesWon: 60 - i * 5,
        gamesLost: 40 + i * 5,
        points: ids.length - 1 - i,
        setPct: 0.5,
        gamePct: 0.5,
      })),
      trace: [],
    };
  }

  it('flattens every group into one list', () => {
    const out = rankAcrossGroups([
      { groupId: 'g1', ranked: rankedOf(['a', 'b', 'c']) },
      { groupId: 'g2', ranked: rankedOf(['d', 'e', 'f']) },
    ]);
    expect(out.entries).toHaveLength(6);
  });

  it('orders by group position first, so all winners precede all runners-up', () => {
    const out = rankAcrossGroups([
      { groupId: 'g1', ranked: rankedOf(['a', 'b', 'c']) },
      { groupId: 'g2', ranked: rankedOf(['d', 'e', 'f']) },
    ]);
    expect(out.entries.slice(0, 2).map((e) => e.groupRank)).toEqual([1, 1]);
    expect(out.entries.slice(2, 4).map((e) => e.groupRank)).toEqual([2, 2]);
  });

  it('reports no correction when every group is the same size', () => {
    const out = rankAcrossGroups([
      { groupId: 'g1', ranked: rankedOf(['a', 'b', 'c']) },
      { groupId: 'g2', ranked: rankedOf(['d', 'e', 'f']) },
    ]);
    expect(out.corrected).toBe(false);
    expect(out.countedAgainstTopN).toBe(2);
    expect(out.note).toBe('All groups have 3 entrants, so results are directly comparable.');
  });

  it('applies the smallest-group correction when sizes differ', () => {
    // A group of four and a group of five are not directly comparable: one
    // played three matches, the other four.
    const out = rankAcrossGroups([
      { groupId: 'g1', ranked: rankedOf(['a', 'b', 'c', 'd']) },
      { groupId: 'g2', ranked: rankedOf(['e', 'f', 'g', 'h', 'i']) },
    ]);
    expect(out.corrected).toBe(true);
    expect(out.countedAgainstTopN).toBe(3);
    expect(out.note).toContain('top 3 finishers in each group');
  });

  it('handles no groups at all', () => {
    const out = rankAcrossGroups([]);
    expect(out.entries).toEqual([]);
    expect(out.corrected).toBe(false);
  });

  it('breaks ties deterministically rather than by input order', () => {
    const forwards = rankAcrossGroups([
      { groupId: 'g1', ranked: rankedOf(['a', 'b']) },
      { groupId: 'g2', ranked: rankedOf(['c', 'd']) },
    ]);
    const backwards = rankAcrossGroups([
      { groupId: 'g2', ranked: rankedOf(['c', 'd']) },
      { groupId: 'g1', ranked: rankedOf(['a', 'b']) },
    ]);
    expect(forwards.entries.map((e) => e.entrantId)).toEqual(
      backwards.entries.map((e) => e.entrantId),
    );
  });
});
