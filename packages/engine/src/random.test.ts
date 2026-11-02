import { describe, expect, it } from 'vitest';
import { createRng } from './random.js';

describe('createRng', () => {
  it('produces an identical stream for the same seed', () => {
    const a = createRng('autumn-open-26');
    const b = createRng('autumn-open-26');

    const left = Array.from({ length: 64 }, () => a.next());
    const right = Array.from({ length: 64 }, () => b.next());

    expect(left).toEqual(right);
  });

  it('produces a different stream for a different seed', () => {
    const a = Array.from({ length: 32 }, (_, i) => createRng(`seed-${i}`).next());
    expect(new Set(a).size).toBe(32);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 5_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('survives a degenerate empty seed without collapsing to zeros', () => {
    const rng = createRng('');
    const values = Array.from({ length: 16 }, () => rng.next());
    expect(new Set(values).size).toBeGreaterThan(1);
    expect(values.every((v) => v === 0)).toBe(false);
  });

  describe('nextInt', () => {
    it('stays within [0, maxExclusive)', () => {
      const rng = createRng('ints');
      for (let i = 0; i < 2_000; i++) {
        const v = rng.nextInt(128);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(128);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('returns 0 for degenerate ranges', () => {
      const rng = createRng('degenerate');
      expect(rng.nextInt(1)).toBe(0);
      expect(rng.nextInt(0)).toBe(0);
      expect(rng.nextInt(-5)).toBe(0);
    });

    it('covers the whole range given enough draws', () => {
      const rng = createRng('coverage');
      const seen = new Set<number>();
      for (let i = 0; i < 1_000; i++) seen.add(rng.nextInt(8));
      expect(seen.size).toBe(8);
    });
  });

  describe('shuffle', () => {
    const input = Array.from({ length: 32 }, (_, i) => i);

    it('never mutates its input', () => {
      const rng = createRng('purity');
      const copy = [...input];
      rng.shuffle(input);
      expect(input).toEqual(copy);
    });

    it('is a permutation — same members, nothing lost or duplicated', () => {
      const rng = createRng('permutation');
      const out = rng.shuffle(input);
      expect(out).toHaveLength(input.length);
      expect([...out].sort((x, y) => x - y)).toEqual(input);
    });

    it('is deterministic for a given seed', () => {
      expect(createRng('draw-1').shuffle(input)).toEqual(createRng('draw-1').shuffle(input));
    });

    it('actually reorders', () => {
      const out = createRng('reorder').shuffle(input);
      expect(out).not.toEqual(input);
    });

    it('handles empty and single-element inputs', () => {
      const rng = createRng('edges');
      expect(rng.shuffle([])).toEqual([]);
      expect(rng.shuffle(['only'])).toEqual(['only']);
    });
  });

  describe('sample', () => {
    it('returns n distinct members', () => {
      const out = createRng('sample').sample([1, 2, 3, 4, 5, 6, 7, 8], 3);
      expect(out).toHaveLength(3);
      expect(new Set(out).size).toBe(3);
    });

    it('clamps to the input length rather than padding', () => {
      expect(createRng('clamp').sample([1, 2], 10)).toHaveLength(2);
    });

    it('returns empty for non-positive n', () => {
      expect(createRng('zero').sample([1, 2, 3], 0)).toEqual([]);
      expect(createRng('neg').sample([1, 2, 3], -3)).toEqual([]);
    });
  });

  /**
   * The determinism guarantee the whole package rests on: identical inputs plus
   * an identical seed produce byte-identical output. Formats spec §6.6 asks for
   * 1000 runs; this is that assertion in its cheapest useful form.
   */
  it('is byte-identical across 1000 independent runs', () => {
    const field = Array.from({ length: 48 }, (_, i) => `entrant-${i}`);
    const expected = JSON.stringify(createRng('riverside-autumn-2026').shuffle(field));

    for (let run = 0; run < 1_000; run++) {
      expect(JSON.stringify(createRng('riverside-autumn-2026').shuffle(field))).toBe(expected);
    }
  });
});
