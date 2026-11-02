/**
 * Fixture builders for engine tests.
 *
 * The seeding-mode helpers exist because the formats spec requires every
 * generation path to be exercised in all three modes (§2.4), and because the
 * fully unseeded case is the production default rather than an edge case —
 * players self-select their category and there are no ratings to sort by.
 */

import type { Entrant, EntrantStatus } from '../types.js';

export interface FixtureOptions {
  /** Prefix for generated ids. Default "e". */
  readonly prefix?: string;
  /** Status applied to every entrant. Default "active". */
  readonly status?: EntrantStatus;
  /** Club id per index, for the same-club avoidance constraint. */
  readonly clubFor?: (index: number) => string | undefined;
}

function build(
  count: number,
  seedFor: (index: number) => number | null,
  options: FixtureOptions = {},
): Entrant[] {
  const prefix = options.prefix ?? 'e';
  const status = options.status ?? 'active';

  return Array.from({ length: count }, (_, i): Entrant => {
    const clubId = options.clubFor?.(i);
    return {
      id: `${prefix}${i + 1}`,
      seed: seedFor(i),
      status,
      ...(clubId === undefined ? {} : { clubId }),
    };
  });
}

/** Every entrant unseeded. The common case in production. */
export function unseeded(count: number, options?: FixtureOptions): Entrant[] {
  return build(count, () => null, options);
}

/** Every entrant seeded 1..count, in id order. */
export function fullySeeded(count: number, options?: FixtureOptions): Entrant[] {
  return build(count, (i) => i + 1, options);
}

/** First `seededCount` entrants seeded 1..seededCount; the rest unseeded. */
export function partiallySeeded(
  count: number,
  seededCount: number,
  options?: FixtureOptions,
): Entrant[] {
  return build(count, (i) => (i < seededCount ? i + 1 : null), options);
}

/** All three seeding modes for a given field size, for table-driven tests. */
export function allSeedingModes(count: number): ReadonlyArray<{
  readonly label: string;
  readonly entrants: Entrant[];
}> {
  const partialK = Math.min(count, Math.max(2, Math.floor(count / 4)));
  return [
    { label: 'unseeded', entrants: unseeded(count) },
    { label: `partial(${partialK})`, entrants: partiallySeeded(count, partialK) },
    { label: 'seeded', entrants: fullySeeded(count) },
  ];
}

/** Powers of two plus the awkward sizes in between, for sweep tests. */
export function drawSizeSweep(max = 128): number[] {
  const sizes: number[] = [];
  for (let n = 2; n <= max; n++) sizes.push(n);
  return sizes;
}
