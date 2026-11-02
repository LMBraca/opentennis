import { describe, expect, it } from 'vitest';
import { EngineError } from './errors.js';
import {
  MAX_DRAW_SIZE,
  bracketSizeFor,
  byeCountFor,
  firstRoundPairs,
  isPowerOfTwo,
  roundCountFor,
  roundNameFor,
  seedOrder,
  seedPositions,
} from './bracket.js';
import { drawSizeSweep } from './testing/fixtures.js';

describe('isPowerOfTwo', () => {
  it('accepts powers of two', () => {
    for (const n of [1, 2, 4, 8, 16, 32, 64, 128]) expect(isPowerOfTwo(n)).toBe(true);
  });

  it('rejects everything else', () => {
    for (const n of [0, 3, 5, 6, 7, 12, 31, 100, -2, 2.5]) expect(isPowerOfTwo(n)).toBe(false);
  });
});

describe('bracketSizeFor', () => {
  it('returns the entrant count itself for exact powers of two', () => {
    for (const n of [2, 4, 8, 16, 32, 64, 128]) expect(bracketSizeFor(n)).toBe(n);
  });

  it('rounds up to the next power of two otherwise', () => {
    expect(bracketSizeFor(3)).toBe(4);
    expect(bracketSizeFor(5)).toBe(8);
    expect(bracketSizeFor(9)).toBe(16);
    expect(bracketSizeFor(17)).toBe(32);
    expect(bracketSizeFor(33)).toBe(64);
    expect(bracketSizeFor(48)).toBe(64);
    expect(bracketSizeFor(65)).toBe(128);
  });

  it('never returns a size below the entrant count', () => {
    for (const n of drawSizeSweep(MAX_DRAW_SIZE)) {
      expect(bracketSizeFor(n)).toBeGreaterThanOrEqual(n);
      expect(isPowerOfTwo(bracketSizeFor(n))).toBe(true);
    }
  });

  it('rejects fields that are too small', () => {
    for (const n of [1, 0, -4]) {
      expect(() => bracketSizeFor(n)).toThrow(EngineError);
      expect(() => bracketSizeFor(n)).toThrow(/at least 2/);
    }
  });

  it('rejects fields above the supported maximum rather than degrading', () => {
    expect(() => bracketSizeFor(129)).toThrow(/not supported/);
    try {
      bracketSizeFor(500);
    } catch (e) {
      expect((e as EngineError).code).toBe('TOO_MANY_ENTRANTS');
    }
  });

  it('rejects non-integers', () => {
    expect(() => bracketSizeFor(8.5)).toThrow(EngineError);
  });
});

describe('byeCountFor', () => {
  it('is zero for exact powers of two', () => {
    for (const n of [2, 4, 8, 16, 32, 64, 128]) expect(byeCountFor(n)).toBe(0);
  });

  it('fills the gap to the next power of two', () => {
    expect(byeCountFor(3)).toBe(1);
    expect(byeCountFor(5)).toBe(3);
    expect(byeCountFor(12)).toBe(4);
    expect(byeCountFor(48)).toBe(16);
  });

  it('is always strictly fewer than the field size', () => {
    // Otherwise there would be more byes than players, which is not a draw.
    for (const n of drawSizeSweep(MAX_DRAW_SIZE)) {
      expect(byeCountFor(n)).toBeLessThan(n);
    }
  });
});

describe('roundCountFor', () => {
  it('counts rounds as log2 of the bracket', () => {
    expect(roundCountFor(2)).toBe(1);
    expect(roundCountFor(4)).toBe(2);
    expect(roundCountFor(8)).toBe(3);
    expect(roundCountFor(128)).toBe(7);
  });

  it('rejects non-power-of-two sizes', () => {
    expect(() => roundCountFor(12)).toThrow(EngineError);
    expect(() => roundCountFor(1)).toThrow(EngineError);
  });
});

describe('seedOrder', () => {
  it('matches the published orders', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ]);
  });

  it('is a permutation of 1..size', () => {
    for (const size of [2, 4, 8, 16, 32, 64, 128]) {
      const order = seedOrder(size);
      expect(order).toHaveLength(size);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: size }, (_, i) => i + 1),
      );
    }
  });

  it('pairs each first-round match to sum to size + 1', () => {
    // 1 v 16, 8 v 9, 4 v 13 ... every opening match is a mirror pair.
    for (const size of [4, 8, 16, 32, 64, 128]) {
      const order = seedOrder(size);
      for (let i = 0; i < size; i += 2) {
        expect((order[i] as number) + (order[i + 1] as number)).toBe(size + 1);
      }
    }
  });

  it('rejects sizes that are not powers of two', () => {
    expect(() => seedOrder(6)).toThrow(EngineError);
    expect(() => seedOrder(1)).toThrow(EngineError);
  });

  /**
   * The properties that make a seeded draw fair. These are the real contract —
   * the literal arrays above are just a convenient tripwire.
   */
  describe('seed separation', () => {
    const sizes = [4, 8, 16, 32, 64, 128];

    function segmentOf(position: number, size: number, segments: number): number {
      return Math.floor(position / (size / segments));
    }

    it('keeps seeds 1 and 2 in opposite halves', () => {
      for (const size of sizes) {
        const pos = seedPositions(size);
        expect(segmentOf(pos[1] as number, size, 2)).not.toBe(
          segmentOf(pos[2] as number, size, 2),
        );
      }
    });

    it('keeps seeds 1-4 in separate quarters', () => {
      for (const size of sizes.filter((s) => s >= 4)) {
        const pos = seedPositions(size);
        const quarters = [1, 2, 3, 4].map((s) => segmentOf(pos[s] as number, size, 4));
        expect(new Set(quarters).size).toBe(4);
      }
    });

    it('keeps seeds 1-8 in separate eighths', () => {
      for (const size of sizes.filter((s) => s >= 8)) {
        const pos = seedPositions(size);
        const eighths = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => segmentOf(pos[s] as number, size, 8));
        expect(new Set(eighths).size).toBe(8);
      }
    });

    it('puts seed 1 at the top of the draw', () => {
      for (const size of sizes) expect(seedPositions(size)[1]).toBe(0);
    });
  });
});

describe('seedPositions', () => {
  it('inverts seedOrder', () => {
    for (const size of [4, 8, 16, 32]) {
      const order = seedOrder(size);
      const positions = seedPositions(size);
      for (let p = 0; p < size; p++) {
        expect(positions[order[p] as number]).toBe(p);
      }
    }
  });
});

describe('roundNameFor', () => {
  it('names rounds by distance to the final', () => {
    expect(roundNameFor(1)).toBe('Final');
    expect(roundNameFor(2)).toBe('Semifinal');
    expect(roundNameFor(4)).toBe('Quarterfinal');
    expect(roundNameFor(8)).toBe('Round of 16');
    expect(roundNameFor(16)).toBe('Round of 32');
    expect(roundNameFor(32)).toBe('Round of 64');
    expect(roundNameFor(64)).toBe('Round of 128');
  });

  it('rejects impossible round widths', () => {
    expect(() => roundNameFor(3)).toThrow(EngineError);
  });
});

describe('firstRoundPairs', () => {
  it('pairs adjacent slots', () => {
    expect(firstRoundPairs(4)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('produces half as many pairs as slots, covering every slot once', () => {
    for (const size of [2, 4, 8, 16, 32, 64, 128]) {
      const pairs = firstRoundPairs(size);
      expect(pairs).toHaveLength(size / 2);
      expect(new Set(pairs.flatMap((p) => [...p])).size).toBe(size);
    }
  });
});
