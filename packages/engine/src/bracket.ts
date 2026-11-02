/**
 * Bracket arithmetic: sizing, seed placement, bye counts, round naming.
 *
 * Pure number-crunching with no entrant knowledge. Everything here is derived
 * from docs/tournament-formats.md §2.1-2.5.
 */

import { engineError } from './errors.js';

/** Smallest workable field. A one-entrant draw is not a draw. */
export const MIN_DRAW_SIZE = 2;

/**
 * Above this we reject rather than degrade. A 256-draw at a club tournament is
 * a data-entry mistake far more often than it is a real field.
 */
export const MAX_DRAW_SIZE = 128;

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0;
}

/**
 * The next power of two at or above the field size — the number of slots the
 * bracket actually has.
 */
export function bracketSizeFor(entrantCount: number): number {
  if (!Number.isInteger(entrantCount)) {
    throw engineError('TOO_FEW_ENTRANTS', 'Entrant count must be an integer', { entrantCount });
  }
  if (entrantCount < MIN_DRAW_SIZE) {
    throw engineError(
      'TOO_FEW_ENTRANTS',
      `A single-elimination draw needs at least ${MIN_DRAW_SIZE} entrants`,
      { entrantCount },
    );
  }
  if (entrantCount > MAX_DRAW_SIZE) {
    throw engineError(
      'TOO_MANY_ENTRANTS',
      `Draws above ${MAX_DRAW_SIZE} entrants are not supported`,
      { entrantCount, max: MAX_DRAW_SIZE },
    );
  }

  let size = 1;
  while (size < entrantCount) size *= 2;
  return size;
}

/** Slots that will go unfilled, and therefore the number of byes to award. */
export function byeCountFor(entrantCount: number): number {
  return bracketSizeFor(entrantCount) - entrantCount;
}

/** Number of rounds in a bracket of the given size. */
export function roundCountFor(bracketSize: number): number {
  if (!isPowerOfTwo(bracketSize) || bracketSize < MIN_DRAW_SIZE) {
    throw engineError('TOO_FEW_ENTRANTS', 'Bracket size must be a power of two of at least 2', {
      bracketSize,
    });
  }
  return Math.log2(bracketSize);
}

/**
 * Standard mirrored ("snake") seed placement. Returns an array where index
 * `position` holds the seed number that belongs in that bracket slot.
 *
 *   size 4  -> [1, 4, 2, 3]
 *   size 8  -> [1, 8, 4, 5, 2, 7, 3, 6]
 *
 * The construction guarantees that seeds 1 and 2 cannot meet before the final,
 * seeds 1-4 sit in separate quarters, and seeds 1-8 in separate eighths.
 *
 * Each pass doubles the bracket and mirrors every existing seed against the
 * new total plus one, so a slot holding seed `s` gains a partner holding
 * `(2 * currentLength + 1) - s`.
 */
export function seedOrder(size: number): number[] {
  if (!isPowerOfTwo(size) || size < MIN_DRAW_SIZE) {
    throw engineError('TOO_FEW_ENTRANTS', 'Seed order requires a power-of-two size of at least 2', {
      size,
    });
  }

  let order: number[] = [1, 2];
  while (order.length < size) {
    const mirror = order.length * 2 + 1;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, mirror - seed);
    }
    order = next;
  }
  return order;
}

/**
 * Inverse of seedOrder: seed number -> bracket position. Index 0 is unused so
 * that lookup reads naturally as `positions[seed]`.
 */
export function seedPositions(size: number): number[] {
  const order = seedOrder(size);
  const positions = new Array<number>(size + 1).fill(-1);
  for (let position = 0; position < order.length; position++) {
    positions[order[position] as number] = position;
  }
  return positions;
}

/**
 * Round name derived from distance to the final, not from round index — so the
 * quarterfinal of a 16-draw and the quarterfinal of a 128-draw share a name.
 */
export function roundNameFor(matchesInRound: number): string {
  if (!isPowerOfTwo(matchesInRound)) {
    throw engineError('TOO_FEW_ENTRANTS', 'Matches in a round must be a power of two', {
      matchesInRound,
    });
  }
  switch (matchesInRound) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinal';
    case 4:
      return 'Quarterfinal';
    default:
      return `Round of ${matchesInRound * 2}`;
  }
}

/**
 * First-round slot pairings as [positionA, positionB]. Slot 2i meets slot 2i+1,
 * which is what makes seedOrder's mirroring produce the right opponents.
 */
export function firstRoundPairs(bracketSize: number): Array<readonly [number, number]> {
  roundCountFor(bracketSize); // validation
  const pairs: Array<readonly [number, number]> = [];
  for (let i = 0; i < bracketSize; i += 2) {
    pairs.push([i, i + 1] as const);
  }
  return pairs;
}
