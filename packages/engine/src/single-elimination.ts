/**
 * Single-elimination draw generation.
 *
 * Spec: docs/tournament-formats.md §2.
 *
 * The output is a complete structure: every match in every round exists the
 * moment a draw is generated, with undecided sides pointing at the match that
 * will feed them. That is what lets the public bracket render, animate, and be
 * shared before a single ball is hit.
 *
 * Three seeding modes must all work, and the fully unseeded one is the
 * production default rather than an edge case — there are no ratings in this
 * product, so most draws arrive with every seed null.
 */

import {
  bracketSizeFor,
  byeCountFor,
  firstRoundPairs,
  roundCountFor,
  roundNameFor,
  seedPositions,
} from './bracket';
import { engineError } from './errors';
import { article } from './prose';
import { createRng, type Rng } from './random';
import type {
  Entrant,
  EntrantId,
  GeneratedMatch,
  GeneratedRound,
  GeneratedStage,
  GenerationMeta,
  MatchSide,
  SeedingMode,
} from './types';

export interface SingleEliminationConfig {
  readonly entrants: readonly Entrant[];
  /** Persisted by the application so a draw can be reproduced or audited. */
  readonly randomSeed: string;
  /**
   * Best-effort avoidance of same-club first-round meetings. Club affiliation
   * is the only grouping signal the product has, so this is the sole available
   * fairness heuristic. Never fails a draw — gives up and places anyway.
   */
  readonly avoidSameClubRound1?: boolean;
  /**
   * Add a playoff between the two beaten semifinalists. Silently ignored when
   * the bracket has no semifinal round (a 2-entrant draw is only a final), on
   * the grounds that erroring at an organizer for a toggle that simply cannot
   * apply is worse than quietly not producing the match.
   */
  readonly thirdPlacePlayoff?: boolean;
}

/** Bounded retries for the same-club constraint, then we place anyway. */
const SAME_CLUB_MAX_ATTEMPTS = 256;

/** Partner slot within a first-round pair: (0,1), (2,3), (4,5) ... */
function partnerSlot(position: number): number {
  return position ^ 1;
}

export function matchIdFor(roundIndex: number, slotIndex: number): string {
  return `r${roundIndex}m${slotIndex}`;
}

function activeEntrantsOf(entrants: readonly Entrant[]): Entrant[] {
  return entrants.filter((e) => e.status === 'active');
}

function validate(entrants: readonly Entrant[]): void {
  const ids = new Set<EntrantId>();
  for (const e of entrants) {
    if (ids.has(e.id)) {
      throw engineError('DUPLICATE_ENTRANT_ID', `Entrant id "${e.id}" appears more than once`, {
        entrantId: e.id,
      });
    }
    ids.add(e.id);
  }

  const seeds = new Set<number>();
  for (const e of entrants) {
    if (e.seed === null) continue;
    if (!Number.isInteger(e.seed) || e.seed < 1) {
      throw engineError('SEED_OUT_OF_RANGE', `Seed must be a positive integer, got ${e.seed}`, {
        entrantId: e.id,
        seed: e.seed,
      });
    }
    if (e.seed > entrants.length) {
      throw engineError(
        'SEED_OUT_OF_RANGE',
        `Seed ${e.seed} exceeds the field size of ${entrants.length}`,
        { entrantId: e.id, seed: e.seed, fieldSize: entrants.length },
      );
    }
    if (seeds.has(e.seed)) {
      throw engineError('DUPLICATE_SEED', `Seed ${e.seed} is assigned to more than one entrant`, {
        seed: e.seed,
      });
    }
    seeds.add(e.seed);
  }
}

function seedingModeOf(seededCount: number, total: number): SeedingMode {
  if (seededCount === 0) return 'unseeded';
  if (seededCount === total) return 'seeded';
  return 'partial';
}

/**
 * Choose which bracket slots stay empty.
 *
 * Byes go to the strongest part of the field first: entrants in seed order get
 * them, and any byes left over are distributed at random among the unseeded.
 * With a fully unseeded field every bye is random, which is the correct
 * behaviour rather than a fallback — §2.3's "byes to top seeds" has no meaning
 * when nobody is seeded.
 *
 * Returns positions that must be left unfilled. Always fewer than bracketSize/2,
 * because bracketSize is the *next* power of two above the field.
 */
function chooseEmptySlots(
  seededInOrder: readonly Entrant[],
  byeCount: number,
  bracketSize: number,
  positions: readonly number[],
  rng: Rng,
): Set<number> {
  const empty = new Set<number>();
  const usedPairs = new Set<number>();

  // Seeded entrants first, strongest outward.
  for (const entrant of seededInOrder) {
    if (empty.size >= byeCount) break;
    const own = positions[entrant.seed as number] as number;
    empty.add(partnerSlot(own));
    usedPairs.add(own >> 1);
  }

  // Any remaining byes land randomly among pairs that no seed occupies.
  if (empty.size < byeCount) {
    const seededPairs = new Set<number>();
    for (const entrant of seededInOrder) {
      seededPairs.add((positions[entrant.seed as number] as number) >> 1);
    }

    const availablePairs: number[] = [];
    for (let pair = 0; pair < bracketSize / 2; pair++) {
      if (!usedPairs.has(pair) && !seededPairs.has(pair)) availablePairs.push(pair);
    }

    for (const pair of rng.shuffle(availablePairs)) {
      if (empty.size >= byeCount) break;
      // Which half of the pair goes empty is immaterial to the structure, but
      // deciding it with the seeded PRNG keeps the draw honestly random.
      empty.add(pair * 2 + rng.nextInt(2));
    }
  }

  return empty;
}

/** Place seeded entrants at their mirrored positions, then fill the gaps. */
function placeEntrants(
  seededInOrder: readonly Entrant[],
  unseededShuffled: readonly Entrant[],
  bracketSize: number,
  positions: readonly number[],
  emptySlots: ReadonlySet<number>,
): Array<EntrantId | null> {
  const slots = new Array<EntrantId | null>(bracketSize).fill(null);

  for (const entrant of seededInOrder) {
    slots[positions[entrant.seed as number] as number] = entrant.id;
  }

  let cursor = 0;
  for (const entrant of unseededShuffled) {
    while (cursor < bracketSize && (slots[cursor] !== null || emptySlots.has(cursor))) cursor++;
    // Unreachable: bracketSize - byeCount === entrantCount by construction, so
    // there is always room. Kept because silently dropping an entrant from a
    // draw is the worst failure this function could have.
    /* v8 ignore next 5 -- invariant guard, see comment above */
    if (cursor >= bracketSize) {
      throw engineError('TOO_MANY_ENTRANTS', 'Ran out of bracket slots while placing entrants', {
        bracketSize,
      });
    }
    slots[cursor] = entrant.id;
    cursor++;
  }

  return slots;
}

/** Count first-round pairs where both occupants share a club. */
function sameClubCollisions(
  slots: ReadonlyArray<EntrantId | null>,
  clubOf: ReadonlyMap<EntrantId, string | undefined>,
): number {
  let collisions = 0;
  for (const [a, b] of firstRoundPairs(slots.length)) {
    const left = slots[a];
    const right = slots[b];
    if (left === null || right === null || left === undefined || right === undefined) continue;
    const clubA = clubOf.get(left);
    const clubB = clubOf.get(right);
    if (clubA !== undefined && clubA === clubB) collisions++;
  }
  return collisions;
}

function describe(
  mode: SeedingMode,
  entrantCount: number,
  seededCount: number,
  bracketSize: number,
  byeCount: number,
  seededByes: number,
): string {
  const field =
    mode === 'unseeded'
      ? `Unseeded random draw of ${entrantCount} entrants`
      : mode === 'seeded'
        ? `Fully seeded draw of ${entrantCount} entrants`
        : `${seededCount} of ${entrantCount} entrants seeded`;

  const bracket = `in ${article(bracketSize)} ${bracketSize} bracket`;

  if (byeCount === 0) return `${field} ${bracket} — no byes.`;

  const plural = byeCount === 1 ? 'bye' : 'byes';
  if (seededByes === 0) {
    return `${field} ${bracket} — ${byeCount} ${plural} assigned at random.`;
  }
  if (seededByes === byeCount) {
    const range = seededByes === 1 ? 'seed 1' : `seeds 1–${seededByes}`;
    return `${field} ${bracket} — ${byeCount} ${plural} to ${range}.`;
  }
  const random = byeCount - seededByes;
  const range = seededByes === 1 ? 'seed 1' : `seeds 1–${seededByes}`;
  return `${field} ${bracket} — ${byeCount} ${plural}: ${seededByes} to ${range}, ${random} assigned at random among unseeded entrants.`;
}

export function generateSingleElimination(config: SingleEliminationConfig): GeneratedStage {
  const active = activeEntrantsOf(config.entrants);
  validate(active);

  const entrantCount = active.length;
  const bracketSize = bracketSizeFor(entrantCount);
  const byeCount = byeCountFor(entrantCount);
  const rounds = roundCountFor(bracketSize);
  const positions = seedPositions(bracketSize);

  const seededInOrder = active
    .filter((e) => e.seed !== null)
    .sort((a, b) => (a.seed as number) - (b.seed as number));
  const unseeded = active.filter((e) => e.seed === null);
  const mode = seedingModeOf(seededInOrder.length, entrantCount);

  const rng = createRng(config.randomSeed);
  const emptySlots = chooseEmptySlots(seededInOrder, byeCount, bracketSize, positions, rng);
  const seededByes = Math.min(byeCount, seededInOrder.length);

  let slots = placeEntrants(seededInOrder, rng.shuffle(unseeded), bracketSize, positions, emptySlots);

  // Best-effort same-club avoidance. Reshuffles only the unseeded portion, so
  // seeded placement -- the part an organizer can be held to -- never moves.
  if (config.avoidSameClubRound1 === true && unseeded.length > 1) {
    const clubOf = new Map<EntrantId, string | undefined>(active.map((e) => [e.id, e.clubId]));
    let best = slots;
    let bestCollisions = sameClubCollisions(slots, clubOf);

    for (let attempt = 0; attempt < SAME_CLUB_MAX_ATTEMPTS && bestCollisions > 0; attempt++) {
      const candidate = placeEntrants(
        seededInOrder,
        rng.shuffle(unseeded),
        bracketSize,
        positions,
        emptySlots,
      );
      const collisions = sameClubCollisions(candidate, clubOf);
      if (collisions < bestCollisions) {
        best = candidate;
        bestCollisions = collisions;
      }
    }
    slots = best;
  }

  const byeRecipients: EntrantId[] = [];
  const generatedRounds: GeneratedRound[] = [];

  // Round 0 comes from slot occupancy; later rounds come from the round below.
  const firstRoundMatches: GeneratedMatch[] = firstRoundPairs(bracketSize).map(
    ([a, b], slotIndex) => {
      const left = slots[a] ?? null;
      const right = slots[b] ?? null;
      const isBye = left === null || right === null;

      if (isBye) {
        const present = left ?? right;
        if (present !== null) byeRecipients.push(present);
      }

      const sides: readonly [MatchSide, MatchSide] = [
        {
          position: 0,
          entrantId: left,
          sourceRef: left === null ? { kind: 'bye' } : null,
        },
        {
          position: 1,
          entrantId: right,
          sourceRef: right === null ? { kind: 'bye' } : null,
        },
      ];

      return {
        id: matchIdFor(0, slotIndex),
        roundIndex: 0,
        slotIndex,
        sides,
        status: isBye ? 'bye' : 'pending',
      } satisfies GeneratedMatch;
    },
  );

  generatedRounds.push({
    index: 0,
    name: roundNameFor(firstRoundMatches.length),
    kind: 'main',
    matches: firstRoundMatches,
  });

  for (let roundIndex = 1; roundIndex < rounds; roundIndex++) {
    const previous = generatedRounds[roundIndex - 1] as GeneratedRound;
    const matchCount = previous.matches.length / 2;
    const matches: GeneratedMatch[] = [];

    for (let slotIndex = 0; slotIndex < matchCount; slotIndex++) {
      const feeders = [
        previous.matches[slotIndex * 2] as GeneratedMatch,
        previous.matches[slotIndex * 2 + 1] as GeneratedMatch,
      ] as const;

      // A bye's winner is known at generation time, so resolve it now. The
      // sourceRef is kept alongside so provenance stays visible in the UI.
      const sideFrom = (feeder: GeneratedMatch, position: 0 | 1): MatchSide => ({
        position,
        entrantId:
          feeder.status === 'bye'
            ? (feeder.sides[0].entrantId ?? feeder.sides[1].entrantId ?? null)
            : null,
        sourceRef: { kind: 'winnerOf', matchId: feeder.id },
      });

      const sides: readonly [MatchSide, MatchSide] = [
        sideFrom(feeders[0], 0),
        sideFrom(feeders[1], 1),
      ];

      matches.push({
        id: matchIdFor(roundIndex, slotIndex),
        roundIndex,
        slotIndex,
        sides,
        status: 'pending',
      });
    }

    generatedRounds.push({
      index: roundIndex,
      name: roundNameFor(matchCount),
      kind: 'main',
      matches,
    });
  }

  // Third-place playoff: both sides fed by loserOf the two semifinals. It sits
  // outside the elimination chain, so it gets its own round kind rather than
  // being spliced into the main sequence where a renderer would try to draw a
  // connector out of it.
  if (config.thirdPlacePlayoff === true) {
    const semifinals = generatedRounds.find((r) => r.matches.length === 2);
    if (semifinals !== undefined) {
      const [first, second] = [
        semifinals.matches[0] as GeneratedMatch,
        semifinals.matches[1] as GeneratedMatch,
      ];
      const roundIndex = generatedRounds.length;

      generatedRounds.push({
        index: roundIndex,
        name: 'Third-place playoff',
        kind: 'thirdPlace',
        matches: [
          {
            id: matchIdFor(roundIndex, 0),
            roundIndex,
            slotIndex: 0,
            sides: [
              { position: 0, entrantId: null, sourceRef: { kind: 'loserOf', matchId: first.id } },
              { position: 1, entrantId: null, sourceRef: { kind: 'loserOf', matchId: second.id } },
            ],
            status: 'pending',
          },
        ],
      });
    }
  }

  const meta: GenerationMeta = {
    seedingMode: mode,
    entrantCount,
    seededCount: seededInOrder.length,
    bracketSize,
    byeCount,
    byeRecipients,
    randomSeed: config.randomSeed,
    description: describe(
      mode,
      entrantCount,
      seededInOrder.length,
      bracketSize,
      byeCount,
      seededByes,
    ),
  };

  return { kind: 'singleElimination', rounds: generatedRounds, groups: [], meta };
}
