/**
 * Round robin generation.
 *
 * Spec: docs/tournament-formats.md §3.
 *
 * Everyone plays everyone. The work is not choosing the pairings — those are
 * fixed by the field — but grouping them into rounds where nobody plays twice,
 * so courts and time slots can actually be allocated.
 */

import { engineError } from './errors';
import { createRng } from './random';
import type {
  Entrant,
  EntrantId,
  GeneratedGroup,
  GeneratedMatch,
  GeneratedRound,
  GeneratedStage,
  GenerationMeta,
  GroupId,
  MatchSide,
  SeedingMode,
} from './types';

/**
 * Practical ceiling per group. 12 entrants is already 66 matches, which is more
 * than a club weekend can hold. Above this the answer is groups, not a bigger
 * round robin, so we say so rather than generating something unplayable.
 */
export const MAX_ROUND_ROBIN_SIZE = 12;

export const MIN_ROUND_ROBIN_SIZE = 2;

export interface RoundRobinConfig {
  readonly entrants: readonly Entrant[];
  readonly randomSeed: string;
  /** Everyone plays everyone twice, with sides swapped on the second meeting. */
  readonly doubleRoundRobin?: boolean;
  /** Group id to attribute matches to. Defaults to a single implicit group. */
  readonly groupId?: GroupId;
  /** Display name for the group. Pools are numbered, never lettered. */
  readonly groupName?: string;
}

/** Sentinel for the odd-field placeholder in the circle rotation. */
const IDLE = Symbol('idle');
type Slot = EntrantId | typeof IDLE;

/**
 * Circle method. Fixes the first entrant and rotates the rest, which yields a
 * schedule where every pair meets exactly once and nobody appears twice in a
 * round.
 *
 * An odd field gets a placeholder, and whoever is drawn against it sits that
 * round out. Returns `n-1` rounds for even `n` and `n` rounds for odd `n`.
 */
export function circleRounds(
  entrantIds: readonly EntrantId[],
): Array<{ pairs: Array<readonly [EntrantId, EntrantId]>; idle: EntrantId[] }> {
  const list: Slot[] = [...entrantIds];
  if (list.length % 2 === 1) list.push(IDLE);

  const n = list.length;
  const rounds: Array<{ pairs: Array<readonly [EntrantId, EntrantId]>; idle: EntrantId[] }> = [];

  for (let round = 0; round < n - 1; round++) {
    const pairs: Array<readonly [EntrantId, EntrantId]> = [];
    const idle: EntrantId[] = [];

    for (let i = 0; i < n / 2; i++) {
      const a = list[i] as Slot;
      const b = list[n - 1 - i] as Slot;
      if (a === IDLE) {
        idle.push(b as EntrantId);
      } else if (b === IDLE) {
        idle.push(a as EntrantId);
      } else {
        pairs.push([a, b] as const);
      }
    }

    rounds.push({ pairs, idle });

    // Rotate everything except the first position.
    list.splice(1, 0, list.pop() as Slot);
  }

  return rounds;
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

  if (entrants.length < MIN_ROUND_ROBIN_SIZE) {
    throw engineError(
      'TOO_FEW_ENTRANTS',
      `A round robin needs at least ${MIN_ROUND_ROBIN_SIZE} entrants`,
      { entrantCount: entrants.length },
    );
  }
  if (entrants.length > MAX_ROUND_ROBIN_SIZE) {
    throw engineError(
      'TOO_MANY_ENTRANTS',
      `A single round robin is capped at ${MAX_ROUND_ROBIN_SIZE} entrants — use groups instead`,
      { entrantCount: entrants.length, max: MAX_ROUND_ROBIN_SIZE },
    );
  }
}

function seedingModeOf(seededCount: number, total: number): SeedingMode {
  if (seededCount === 0) return 'unseeded';
  if (seededCount === total) return 'seeded';
  return 'partial';
}

function describe(count: number, matches: number, rounds: number, double: boolean): string {
  const kind = double ? 'Double round robin' : 'Round robin';
  const base = `${kind} of ${count} entrants — ${matches} ${
    matches === 1 ? 'match' : 'matches'
  } across ${rounds} ${rounds === 1 ? 'round' : 'rounds'}`;
  return count % 2 === 1
    ? `${base}; each entrant sits out one round per cycle.`
    : `${base}.`;
}

export function generateRoundRobin(config: RoundRobinConfig): GeneratedStage {
  const active = config.entrants.filter((e) => e.status === 'active');
  validate(active);

  const groupId = config.groupId ?? 'g1';
  const double = config.doubleRoundRobin === true;

  // Seeds do not affect who plays whom in a round robin — everyone plays
  // everyone. They are deliberately ignored here, and the schedule is drawn at
  // random so that round 1 isn't dictated by the order an admin typed names in.
  const rng = createRng(config.randomSeed);
  const orderedIds = rng.shuffle(active.map((e) => e.id));

  const cycle = circleRounds(orderedIds);
  const schedule = double
    ? [
        ...cycle,
        // Second cycle with sides swapped, so each entrant is listed first once.
        ...cycle.map(({ pairs, idle }) => ({
          pairs: pairs.map(([a, b]) => [b, a] as const),
          idle,
        })),
      ]
    : cycle;

  const rounds: GeneratedRound[] = schedule.map(({ pairs, idle }, roundIndex) => {
    const matches: GeneratedMatch[] = pairs.map((pair, slotIndex) => {
      const sides: readonly [MatchSide, MatchSide] = [
        { position: 0, entrantId: pair[0], sourceRef: null },
        { position: 1, entrantId: pair[1], sourceRef: null },
      ];
      return {
        id: `${groupId}r${roundIndex}m${slotIndex}`,
        roundIndex,
        slotIndex,
        sides,
        status: 'pending',
        groupId,
      };
    });

    return {
      index: roundIndex,
      name: `Round ${roundIndex + 1}`,
      kind: 'main',
      groupId,
      matches,
      ...(idle.length > 0 ? { idleEntrantIds: idle } : {}),
    };
  });

  const group: GeneratedGroup = {
    id: groupId,
    // Pools are numbered, never lettered: A/B/C+/C/D are skill categories, and
    // "Group B of the C+ draw" versus "the B draw" is how a player ends up on
    // the wrong court.
    name: config.groupName ?? 'Round robin',
    entrantIds: orderedIds,
  };

  const matchCount = rounds.reduce((sum, r) => sum + r.matches.length, 0);
  const seededCount = active.filter((e) => e.seed !== null).length;

  const meta: GenerationMeta = {
    seedingMode: seedingModeOf(seededCount, active.length),
    entrantCount: active.length,
    seededCount,
    // A round robin has no bracket and no byes. An entrant sitting out a round
    // is idle, not on a bye, and conflating the two would corrupt standings.
    bracketSize: null,
    byeCount: 0,
    byeRecipients: [],
    randomSeed: config.randomSeed,
    description: describe(active.length, matchCount, rounds.length, double),
  };

  return { kind: 'roundRobin', rounds, groups: [group], meta };
}

/** Matches in a round robin of `n` entrants. */
export function roundRobinMatchCount(n: number, double = false): number {
  return ((n * (n - 1)) / 2) * (double ? 2 : 1);
}
