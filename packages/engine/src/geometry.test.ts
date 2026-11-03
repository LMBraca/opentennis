import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import {
  DEFAULT_GEOMETRY,
  type GeometryOptions,
  layoutBracket,
  nodeIndex,
  pitchFor,
  xFor,
  yFor,
} from './geometry';
import { generateSingleElimination } from './single-elimination';
import { drawSizeSweep, unseeded } from './testing/fixtures';
import type { GeneratedStage } from './types';

const OPTS: GeometryOptions = {
  nodeWidth: 100,
  nodeHeight: 20,
  verticalGap: 10,
  columnGap: 40,
};

function stageOf(n: number, thirdPlace = false): GeneratedStage {
  return generateSingleElimination({
    entrants: unseeded(n),
    randomSeed: 'geometry',
    thirdPlacePlayoff: thirdPlace,
  });
}

describe('pitchFor', () => {
  it('doubles every round', () => {
    expect(pitchFor(0, OPTS)).toBe(30);
    expect(pitchFor(1, OPTS)).toBe(60);
    expect(pitchFor(2, OPTS)).toBe(120);
    expect(pitchFor(3, OPTS)).toBe(240);
  });
});

describe('xFor', () => {
  it('advances by node width plus column gap', () => {
    expect(xFor(0, OPTS)).toBe(0);
    expect(xFor(1, OPTS)).toBe(140);
    expect(xFor(2, OPTS)).toBe(280);
  });
});

describe('yFor', () => {
  it('centres each node within its pitch', () => {
    // pitch 30, node 20 -> 5px of slack above and below.
    expect(yFor(0, 0, OPTS)).toBe(5);
    expect(yFor(0, 1, OPTS)).toBe(35);
    expect(yFor(0, 2, OPTS)).toBe(65);
  });

  it('centres a parent exactly between its two children', () => {
    for (let round = 0; round < 5; round++) {
      for (let slot = 0; slot < 4; slot++) {
        const childA = yFor(round, slot * 2, OPTS) + OPTS.nodeHeight / 2;
        const childB = yFor(round, slot * 2 + 1, OPTS) + OPTS.nodeHeight / 2;
        const parent = yFor(round + 1, slot, OPTS) + OPTS.nodeHeight / 2;
        expect(parent).toBeCloseTo((childA + childB) / 2, 10);
      }
    }
  });
});

describe('layoutBracket', () => {
  it('lays out one node per match', () => {
    for (const n of drawSizeSweep(64)) {
      const stage = stageOf(n);
      const layout = layoutBracket(stage, OPTS);
      const matchCount = stage.rounds.flatMap((r) => r.matches).length;
      expect(layout.nodes.length, `n=${n}`).toBe(matchCount);
    }
  });

  it('sizes the canvas to contain every node', () => {
    for (const n of drawSizeSweep(64)) {
      const layout = layoutBracket(stageOf(n), OPTS);
      for (const node of layout.nodes) {
        expect(node.x + node.width, `n=${n}`).toBeLessThanOrEqual(layout.width);
        expect(node.y + node.height, `n=${n}`).toBeLessThanOrEqual(layout.height);
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never overlaps two nodes', () => {
    for (const n of [4, 8, 16, 32, 48]) {
      const layout = layoutBracket(stageOf(n), OPTS);
      const nodes = [...layout.nodes];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const disjoint =
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y;
          expect(disjoint, `n=${n} ${a.matchId} vs ${b.matchId}`).toBe(true);
        }
      }
    }
  });

  it('puts each round in its own column, left to right', () => {
    const layout = layoutBracket(stageOf(16), OPTS);
    const byRound = new Map<number, Set<number>>();
    for (const node of layout.nodes) {
      const set = byRound.get(node.roundIndex) ?? new Set<number>();
      set.add(node.x);
      byRound.set(node.roundIndex, set);
    }
    // One distinct x per round, and x increases with round index.
    const xs = [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => [...s]);
    for (const set of xs) expect(set).toHaveLength(1);
    const flat = xs.map((s) => s[0] as number);
    for (let i = 1; i < flat.length; i++) {
      expect(flat[i] as number).toBeGreaterThan(flat[i - 1] as number);
    }
  });

  describe('connectors', () => {
    it('emits one per winnerOf reference — two per parent, individually addressable', () => {
      const stage = stageOf(16);
      const layout = layoutBracket(stage, OPTS);

      const winnerRefs = stage.rounds
        .filter((r) => r.kind === 'main')
        .flatMap((r) => r.matches)
        .flatMap((m) => m.sides)
        .filter((s) => s.sourceRef?.kind === 'winnerOf').length;

      expect(layout.connectors).toHaveLength(winnerRefs);
    });

    it('draws out of the child and into the parent', () => {
      const stage = stageOf(4);
      const layout = layoutBracket(stage, OPTS);
      const index = nodeIndex(layout);

      for (const connector of layout.connectors) {
        const child = index.get(connector.fromMatchId)!;
        const parent = index.get(connector.toMatchId)!;
        const [, startX, startY] = /^M (\S+) (\S+)/.exec(connector.d)!;

        expect(Number(startX)).toBe(child.x + child.width);
        expect(Number(startY)).toBe(child.centerY);
        expect(connector.d.endsWith(`H ${parent.x}`)).toBe(true);
      }
    });

    it('turns at the midpoint of the column gap', () => {
      const layout = layoutBracket(stageOf(8), OPTS);
      const index = nodeIndex(layout);
      for (const connector of layout.connectors) {
        const child = index.get(connector.fromMatchId)!;
        const expectedMid = child.x + child.width + OPTS.columnGap / 2;
        expect(connector.d).toContain(`H ${expectedMid} V`);
      }
    });

    it('computes exact path length, so the draw animation needs no measurement', () => {
      const layout = layoutBracket(stageOf(16), OPTS);
      const index = nodeIndex(layout);
      for (const connector of layout.connectors) {
        const child = index.get(connector.fromMatchId)!;
        const parent = index.get(connector.toMatchId)!;
        // Two horizontal halves of the gap, plus the vertical run.
        const expected = OPTS.columnGap + Math.abs(parent.centerY - child.centerY);
        expect(connector.length).toBeCloseTo(expected, 10);
      }
    });

    it('gives sibling connectors distinct ids pointing at the same parent', () => {
      const layout = layoutBracket(stageOf(8), OPTS);
      const ids = layout.connectors.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);

      const byParent = new Map<string, number>();
      for (const c of layout.connectors) {
        byParent.set(c.toMatchId, (byParent.get(c.toMatchId) ?? 0) + 1);
      }
      for (const count of byParent.values()) expect(count).toBe(2);
    });

    it('references only matches that have nodes', () => {
      const layout = layoutBracket(stageOf(33), OPTS);
      const index = nodeIndex(layout);
      for (const c of layout.connectors) {
        expect(index.has(c.fromMatchId)).toBe(true);
        expect(index.has(c.toMatchId)).toBe(true);
      }
    });

    it('emits none for a 2-entrant draw, which is a single match', () => {
      expect(layoutBracket(stageOf(2), OPTS).connectors).toHaveLength(0);
    });
  });

  describe('third-place playoff', () => {
    it('places it in the final column, below the bracket', () => {
      const stage = stageOf(8, true);
      const layout = layoutBracket(stage, OPTS);
      const plain = layoutBracket(stageOf(8), OPTS);

      const playoffId = stage.rounds.find((r) => r.kind === 'thirdPlace')?.matches[0]?.id;
      const node = layout.nodes.find((n) => n.matchId === playoffId);

      expect(node).toBeDefined();
      expect(node?.x).toBe(xFor(2, OPTS)); // same column as the final
      expect(node?.y).toBeGreaterThanOrEqual(plain.height);
      expect(layout.height).toBeGreaterThan(plain.height);
    });

    it('does not widen the canvas', () => {
      expect(layoutBracket(stageOf(16, true), OPTS).width).toBe(
        layoutBracket(stageOf(16), OPTS).width,
      );
    });

    it('gets no connectors — it is detached from the elimination chain', () => {
      const stage = stageOf(8, true);
      const layout = layoutBracket(stage, OPTS);
      const playoffId = stage.rounds.find((r) => r.kind === 'thirdPlace')?.matches[0]?.id;

      expect(layout.connectors.some((c) => c.toMatchId === playoffId)).toBe(false);
      expect(layout.connectors.some((c) => c.fromMatchId === playoffId)).toBe(false);
    });

    it('leaves main-bracket geometry identical', () => {
      const withIt = layoutBracket(stageOf(16, true), OPTS);
      const plain = layoutBracket(stageOf(16), OPTS);
      const mainOf = (l: typeof withIt) => l.nodes.filter((n) => n.roundIndex < 4);
      expect(JSON.stringify(mainOf(withIt))).toBe(JSON.stringify(mainOf(plain)));
    });
  });

  describe('options', () => {
    it('defaults to the design system rhythm', () => {
      const layout = layoutBracket(stageOf(4));
      expect(layout.options).toEqual(DEFAULT_GEOMETRY);
      expect(layout.nodes[0]?.width).toBe(DEFAULT_GEOMETRY.nodeWidth);
    });

    it('scales with the options given', () => {
      const small = layoutBracket(stageOf(8), OPTS);
      const large = layoutBracket(stageOf(8), { ...OPTS, nodeWidth: 200, nodeHeight: 40 });
      expect(large.width).toBeGreaterThan(small.width);
      expect(large.height).toBeGreaterThan(small.height);
    });

    it('rejects negative or zero dimensions', () => {
      expect(() => layoutBracket(stageOf(4), { ...OPTS, nodeWidth: 0 })).toThrow(EngineError);
      expect(() => layoutBracket(stageOf(4), { ...OPTS, nodeHeight: -1 })).toThrow(EngineError);
      expect(() => layoutBracket(stageOf(4), { ...OPTS, columnGap: -5 })).toThrow(EngineError);
    });

    it('tolerates a zero gap', () => {
      const layout = layoutBracket(stageOf(8), { ...OPTS, verticalGap: 0, columnGap: 0 });
      expect(layout.nodes).toHaveLength(7);
    });

    it('rejects non-finite values', () => {
      expect(() => layoutBracket(stageOf(4), { ...OPTS, columnGap: Number.NaN })).toThrow(
        EngineError,
      );
    });
  });

  describe('misuse', () => {
    it('refuses a round-robin stage rather than inventing a layout', () => {
      const roundRobin: GeneratedStage = {
        kind: 'roundRobin',
        rounds: [],
        groups: [],
        meta: {
          seedingMode: 'unseeded',
          entrantCount: 4,
          seededCount: 0,
          bracketSize: null,
          byeCount: 0,
          byeRecipients: [],
          randomSeed: 'x',
          description: '',
        },
      };
      expect(() => layoutBracket(roundRobin, OPTS)).toThrow(/Cannot lay out/);
    });

    it('returns an empty layout for a stage with no rounds', () => {
      const empty: GeneratedStage = {
        kind: 'singleElimination',
        rounds: [],
        groups: [],
        meta: {
          seedingMode: 'unseeded',
          entrantCount: 0,
          seededCount: 0,
          bracketSize: null,
          byeCount: 0,
          byeRecipients: [],
          randomSeed: 'x',
          description: '',
        },
      };
      const layout = layoutBracket(empty, OPTS);
      expect(layout.nodes).toEqual([]);
      expect(layout.connectors).toEqual([]);
      expect(layout.width).toBe(0);
      expect(layout.height).toBe(0);
    });
  });

  it('is deterministic for the same stage', () => {
    const stage = stageOf(24);
    expect(JSON.stringify(layoutBracket(stage, OPTS))).toBe(
      JSON.stringify(layoutBracket(stage, OPTS)),
    );
  });
});

describe('nodeIndex', () => {
  it('maps every match id to its node', () => {
    const layout = layoutBracket(stageOf(16), OPTS);
    const index = nodeIndex(layout);
    expect(index.size).toBe(layout.nodes.length);
    for (const node of layout.nodes) expect(index.get(node.matchId)).toBe(node);
  });
});
