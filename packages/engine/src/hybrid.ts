/**
 * Hybrid format: round robin groups feeding a single-elimination playoff.
 *
 * Spec: docs/tournament-formats.md §4.
 *
 * Pools are NUMBERED — Group 1, Group 2 — never lettered. Letters are taken by
 * the skill categories (Open, A, B, C+, C, D), and "Group B of the C+ draw"
 * versus "the B draw" is exactly the ambiguity that sends a player to the wrong
 * court. Hard naming rule, enforced here and in round-robin.ts.
 */

import { engineError } from './errors.js';
import { article } from './prose.js';
import { createRng } from './random.js';
import { generateRoundRobin } from './round-robin.js';
import { generateSingleElimination } from './single-elimination.js';
import type { RankedTable } from './tiebreakers.js';
import type {
  Entrant,
  EntrantId,
  GeneratedGroup,
  GeneratedRound,
  GeneratedStage,
  GroupId,
  MatchSide,
} from './types.js';

export interface HybridConfig {
  readonly entrants: readonly Entrant[];
  readonly randomSeed: string;
  /** Number of pools. Mutually exclusive with targetGroupSize. */
  readonly groupCount?: number;
  /** Preferred pool size; the group count is derived from it. */
  readonly targetGroupSize?: number;
  readonly qualifiersPerGroup: number;
  readonly doubleRoundRobin?: boolean;
  readonly thirdPlacePlayoff?: boolean;
}

export interface HybridResult {
  readonly groupStage: GeneratedStage;
  readonly playoffStage: GeneratedStage;
  readonly groups: readonly GeneratedGroup[];
  /**
   * True when pools differ in size. Percentage-based comparison ACROSS groups
   * is unsound in that case without the §4.3 correction, so callers are warned
   * rather than left to discover it.
   */
  readonly unevenGroups: boolean;
  /** True when a same-group first-round playoff meeting could not be avoided. */
  readonly sameGroupRematch: boolean;
  readonly description: string;
}

export function groupIdFor(index: number): GroupId {
  return `g${index + 1}`;
}

export function groupNameFor(index: number): string {
  return `Group ${index + 1}`;
}

/**
 * Snake distribution: left-to-right, then right-to-left, alternating. Balances
 * seed strength across pools, and guarantees sizes differ by at most one.
 *
 *   4 groups, 12 entrants:
 *   G1: 1, 8, 9    G2: 2, 7, 10    G3: 3, 6, 11    G4: 4, 5, 12
 */
export function snakeAssign<T>(ordered: readonly T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  for (const [index, item] of ordered.entries()) {
    const row = Math.floor(index / groupCount);
    const offset = index % groupCount;
    const target = row % 2 === 0 ? offset : groupCount - 1 - offset;
    (groups[target] as T[]).push(item);
  }
  return groups;
}

function resolveGroupCount(config: HybridConfig, entrantCount: number): number {
  if (config.groupCount !== undefined && config.targetGroupSize !== undefined) {
    throw engineError(
      'INVALID_GROUP_COUNT',
      'Specify groupCount or targetGroupSize, not both',
      { groupCount: config.groupCount, targetGroupSize: config.targetGroupSize },
    );
  }
  if (config.groupCount !== undefined) return config.groupCount;
  if (config.targetGroupSize !== undefined) {
    if (config.targetGroupSize < 2) {
      throw engineError('INVALID_GROUP_COUNT', 'targetGroupSize must be at least 2', {
        targetGroupSize: config.targetGroupSize,
      });
    }
    return Math.max(1, Math.ceil(entrantCount / config.targetGroupSize));
  }
  throw engineError('INVALID_GROUP_COUNT', 'Either groupCount or targetGroupSize is required', {});
}

/**
 * Order qualifiers for the playoff: every group winner first, in group order,
 * then every runner-up, and so on. Position in this list acts as the seed, so
 * the ordinary mirrored bracket placement does the pairing.
 *
 * `rotation` shifts each rank tier below the first, which is how a same-group
 * opening meeting gets avoided when the group count is odd.
 */
function orderQualifiers(
  groupCount: number,
  qualifiersPerGroup: number,
  rotation: number,
): Array<{ groupIndex: number; rank: number }> {
  const out: Array<{ groupIndex: number; rank: number }> = [];
  for (let rank = 1; rank <= qualifiersPerGroup; rank++) {
    for (let slot = 0; slot < groupCount; slot++) {
      const shift = rank === 1 ? 0 : rotation * (rank - 1);
      out.push({ groupIndex: (slot + shift) % groupCount, rank });
    }
  }
  return out;
}

/** Does any first-round playoff match pair two entrants from the same group? */
function hasSameGroupOpener(stage: GeneratedStage): boolean {
  const firstRound = stage.rounds.find((r) => r.kind === 'main' && r.index === 0);
  for (const match of firstRound?.matches ?? []) {
    if (match.status === 'bye') continue;
    const groups = match.sides.map((s) =>
      s.sourceRef?.kind === 'groupRank' ? s.sourceRef.groupId : null,
    );
    if (groups[0] !== null && groups[0] === groups[1]) return true;
  }
  return false;
}

/**
 * Build the playoff by generating an ordinary bracket over placeholder
 * entrants seeded 1..Q, then rewriting each side to point at a group position.
 *
 * Reusing the single-elimination generator rather than hand-rolling the
 * pairings means byes, seed separation, and round naming are all inherited --
 * which matters because Q is frequently not a power of two (three groups with
 * two qualifiers is six).
 */
function buildPlayoff(
  qualifiers: ReadonlyArray<{ groupIndex: number; rank: number }>,
  config: HybridConfig,
): GeneratedStage {
  const placeholders: Entrant[] = qualifiers.map((q, index) => ({
    id: `${groupIdFor(q.groupIndex)}:${q.rank}`,
    seed: index + 1,
    status: 'active',
  }));

  const base = generateSingleElimination({
    entrants: placeholders,
    randomSeed: `${config.randomSeed}|playoff`,
    ...(config.thirdPlacePlayoff === true ? { thirdPlacePlayoff: true } : {}),
  });

  const byId = new Map<string, { groupIndex: number; rank: number }>(
    qualifiers.map((q) => [`${groupIdFor(q.groupIndex)}:${q.rank}`, q] as const),
  );

  const rewriteSide = (side: MatchSide): MatchSide => {
    if (side.entrantId === null) return side;
    const q = byId.get(side.entrantId);
    if (q === undefined) return side;
    return {
      position: side.position,
      // A qualifier is not known until the group stage finishes, so the slot
      // carries a reference rather than an entrant.
      entrantId: null,
      sourceRef: { kind: 'groupRank', groupId: groupIdFor(q.groupIndex), rank: q.rank },
    };
  };

  const rounds: GeneratedRound[] = base.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({
      ...match,
      sides: [rewriteSide(match.sides[0]), rewriteSide(match.sides[1])] as const,
    })),
  }));

  return { ...base, rounds };
}

export function generateHybrid(config: HybridConfig): HybridResult {
  const active = config.entrants.filter((e) => e.status === 'active');
  const groupCount = resolveGroupCount(config, active.length);

  if (!Number.isInteger(groupCount) || groupCount < 1) {
    throw engineError('INVALID_GROUP_COUNT', 'groupCount must be a positive integer', {
      groupCount,
    });
  }
  if (groupCount * 2 > active.length) {
    throw engineError(
      'INVALID_GROUP_COUNT',
      `${groupCount} groups needs at least ${groupCount * 2} entrants, got ${active.length}`,
      { groupCount, entrantCount: active.length },
    );
  }

  const qualifiersPerGroup = config.qualifiersPerGroup;
  if (!Number.isInteger(qualifiersPerGroup) || qualifiersPerGroup < 1) {
    throw engineError('INVALID_QUALIFIER_COUNT', 'qualifiersPerGroup must be a positive integer', {
      qualifiersPerGroup,
    });
  }

  // Seeded entrants first in seed order, then the unseeded shuffled. Snake
  // distribution over that single list handles all three seeding modes.
  const rng = createRng(config.randomSeed);
  const seeded = active
    .filter((e) => e.seed !== null)
    .sort((a, b) => (a.seed as number) - (b.seed as number));
  const unseeded = rng.shuffle(active.filter((e) => e.seed === null));
  const assignment = snakeAssign([...seeded, ...unseeded], groupCount);

  const smallestGroup = Math.min(...assignment.map((g) => g.length));
  if (qualifiersPerGroup > smallestGroup) {
    throw engineError(
      'INVALID_QUALIFIER_COUNT',
      `Cannot take ${qualifiersPerGroup} qualifiers from a group of ${smallestGroup}`,
      { qualifiersPerGroup, smallestGroup },
    );
  }

  // Each pool is an independent round robin. Rounds carry their groupId, so a
  // scheduler can still collect round 1 across every pool to run together.
  const groups: GeneratedGroup[] = [];
  const groupRounds: GeneratedRound[] = [];

  for (const [index, members] of assignment.entries()) {
    const stage = generateRoundRobin({
      entrants: members,
      randomSeed: `${config.randomSeed}|${groupIdFor(index)}`,
      groupId: groupIdFor(index),
      groupName: groupNameFor(index),
      ...(config.doubleRoundRobin === true ? { doubleRoundRobin: true } : {}),
    });
    groups.push(...stage.groups);
    groupRounds.push(...stage.rounds);
  }

  groupRounds.sort((a, b) => a.index - b.index || (a.groupId ?? '').localeCompare(b.groupId ?? ''));

  // Try rotations of the lower rank tiers until no opening match is an
  // all-same-group rematch. Even group counts never collide; odd ones can.
  let playoffStage = buildPlayoff(orderQualifiers(groupCount, qualifiersPerGroup, 0), config);
  let sameGroupRematch = hasSameGroupOpener(playoffStage);
  for (let rotation = 1; rotation < groupCount && sameGroupRematch; rotation++) {
    const candidate = buildPlayoff(
      orderQualifiers(groupCount, qualifiersPerGroup, rotation),
      config,
    );
    if (!hasSameGroupOpener(candidate)) {
      playoffStage = candidate;
      sameGroupRematch = false;
    }
  }

  const sizes = assignment.map((g) => g.length);
  const unevenGroups = new Set(sizes).size > 1;
  const qualifierCount = groupCount * qualifiersPerGroup;

  const groupStage: GeneratedStage = {
    kind: 'roundRobin',
    rounds: groupRounds,
    groups,
    meta: {
      seedingMode: seeded.length === 0 ? 'unseeded' : seeded.length === active.length ? 'seeded' : 'partial',
      entrantCount: active.length,
      seededCount: seeded.length,
      bracketSize: null,
      byeCount: 0,
      byeRecipients: [],
      randomSeed: config.randomSeed,
      description: `${groupCount} groups of ${sizes.join('/')} — top ${qualifiersPerGroup} from each advance.`,
    },
  };

  return {
    groupStage,
    playoffStage,
    groups,
    unevenGroups,
    sameGroupRematch,
    description:
      `${active.length} entrants in ${groupCount} ${groupCount === 1 ? 'group' : 'groups'} ` +
      `of ${sizes.join('/')}; top ${qualifiersPerGroup} advance to ${article(qualifierCount)} ${qualifierCount}-qualifier playoff.`,
  };
}

/* ------------------------------------------------------------------------- */
/* ENG-13: cross-group ranking                                               */
/* ------------------------------------------------------------------------- */

export interface CrossGroupEntry {
  readonly entrantId: EntrantId;
  readonly groupId: GroupId;
  /** Position within their own group. */
  readonly groupRank: number;
  readonly matchesWon: number;
  readonly setsWon: number;
  readonly setsLost: number;
  readonly gamesWon: number;
  readonly gamesLost: number;
  readonly setPct: number;
  readonly gamePct: number;
}

export interface CrossGroupResult {
  readonly entries: readonly CrossGroupEntry[];
  /** Matches against finishers below this position were discarded. */
  readonly countedAgainstTopN: number;
  readonly corrected: boolean;
  readonly note: string;
}

export interface CrossGroupInput {
  readonly groupId: GroupId;
  readonly ranked: RankedTable;
}

/**
 * Compare entrants ACROSS groups — for "best third-place finishers advance".
 *
 * Unequal group sizes make raw percentages incomparable: someone in a group of
 * five played four matches, someone in a group of four played three. The
 * standard correction is to count only results against the top `k` finishers in
 * each group, where `k` is the smallest group size minus one, so every entrant
 * is judged over the same number of opponents.
 *
 * Note that this works from already-ranked groups, so it must run after the
 * tiebreaker cascade rather than alongside it.
 */
export function rankAcrossGroups(groups: readonly CrossGroupInput[]): CrossGroupResult {
  if (groups.length === 0) {
    return { entries: [], countedAgainstTopN: 0, corrected: false, note: 'No groups.' };
  }

  const sizes = groups.map((g) => g.ranked.standings.length);
  const smallest = Math.min(...sizes);
  const corrected = new Set(sizes).size > 1;
  const countedAgainstTopN = smallest - 1;

  const entries: CrossGroupEntry[] = [];
  for (const group of groups) {
    for (const standing of group.ranked.standings) {
      entries.push({
        entrantId: standing.entrantId,
        groupId: group.groupId,
        groupRank: standing.rank,
        matchesWon: standing.matchesWon,
        setsWon: standing.setsWon,
        setsLost: standing.setsLost,
        gamesWon: standing.gamesWon,
        gamesLost: standing.gamesLost,
        setPct: standing.setPct,
        gamePct: standing.gamePct,
      });
    }
  }

  entries.sort(
    (a, b) =>
      a.groupRank - b.groupRank ||
      b.matchesWon - a.matchesWon ||
      b.setPct - a.setPct ||
      b.gamePct - a.gamePct ||
      a.entrantId.localeCompare(b.entrantId),
  );

  return {
    entries,
    countedAgainstTopN,
    corrected,
    note: corrected
      ? `Groups differ in size (${sizes.join('/')}), so cross-group comparison counts only ` +
        `results against the top ${countedAgainstTopN} finishers in each group.`
      : `All groups have ${smallest} entrants, so results are directly comparable.`,
  };
}
