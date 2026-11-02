/**
 * Deterministic pseudo-randomness.
 *
 * Every generator in this package takes an explicit string seed, and that seed
 * is persisted by the application so a draw can be reproduced or audited
 * (docs/tournament-formats.md §1). Nothing here ever touches Math.random.
 *
 * Algorithm: cyrb128 to expand a string seed into four 32-bit state words,
 * then xoshiro128** to produce the stream. Both are small, fast, well-studied,
 * and — critically — fully specified, so the sequence is stable across engines
 * and across Node versions. Statistical quality beyond that is irrelevant here:
 * we are shuffling at most 128 tennis players, not doing Monte Carlo.
 */

/** Expand an arbitrary string into four non-trivial 32-bit words. */
function cyrb128(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  const state: [number, number, number, number] = [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];

  // xoshiro degenerates to a constant zero stream if every state word is zero.
  // No known input to cyrb128 produces that, so this is an invariant guard
  // rather than a reachable branch -- but the failure mode (a "random" draw
  // that is the identity permutation every time) is bad enough to guard anyway.
  /* v8 ignore next 3 -- unreachable by construction; see comment above */
  if (state[0] === 0 && state[1] === 0 && state[2] === 0 && state[3] === 0) {
    return [0x9e3779b9, 0x243f6a88, 0xb7e15162, 0x6a09e667];
  }

  return state;
}

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). Returns 0 when maxExclusive <= 1. */
  nextInt(maxExclusive: number): number;
  /** Fisher-Yates. Returns a new array; never mutates the input. */
  shuffle<T>(items: readonly T[]): T[];
  /** First n items of a shuffle. Returns fewer than n if the input is shorter. */
  sample<T>(items: readonly T[], n: number): T[];
}

/**
 * Create a deterministic generator from a string seed.
 *
 * Two generators built from the same seed produce identical streams, and a
 * generator is stateful: callers that need reproducibility must create a fresh
 * one rather than sharing.
 */
export function createRng(seed: string): Rng {
  let [a, b, c, d] = cyrb128(seed);

  const next = (): number => {
    const t = (b << 9) >>> 0;
    let r = Math.imul(b, 5);
    r = (Math.imul((r << 7) | (r >>> 25), 9) >>> 0) >>> 0;

    c = (c ^ a) >>> 0;
    d = (d ^ b) >>> 0;
    b = (b ^ c) >>> 0;
    a = (a ^ d) >>> 0;
    c = (c ^ t) >>> 0;
    d = ((d << 11) | (d >>> 21)) >>> 0;

    return r / 4294967296;
  };

  const nextInt = (maxExclusive: number): number => {
    if (maxExclusive <= 1) return 0;
    // Multiply-and-floor carries a negligible modulo bias at these magnitudes
    // (max 128). Rejection sampling would buy nothing but a slower, less
    // obviously deterministic function.
    return Math.floor(next() * maxExclusive);
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = nextInt(i + 1);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  };

  return {
    next,
    nextInt,
    shuffle,
    sample: <T>(items: readonly T[], n: number): T[] => shuffle(items).slice(0, Math.max(0, n)),
  };
}
