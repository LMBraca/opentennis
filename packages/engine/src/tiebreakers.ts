/**
 * Round robin tiebreaker cascade.
 *
 * Spec: docs/tournament-formats.md §3.4 and §3.5.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ THE ASYMMETRY. This is the whole reason this module is risky.           │
 * │                                                                         │
 * │ TWO entrants tied:    head-to-head FIRST, then set %, then game %.      │
 * │ THREE OR MORE tied:   set % FIRST, then game %, and head-to-head LAST.  │
 * │                                                                         │
 * │ That inversion is in the real ITF/USTA rules, not a mistake. A single   │
 * │ cascade applied uniformly to all tie sizes is the obvious implementation │
 * │ and it is wrong.                                                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * The other subtlety: when a criterion separates *some but not all* of a tie,
 * the separated entrants are placed and the remaining subgroup is re-resolved
 * FROM THE TOP of the cascade. So a four-way tie that set% reduces to a pair is
 * then settled head-to-head — because it is now a two-way tie. That is why this
 * is written recursively rather than as a sort comparator; a comparator cannot
 * express a rule whose precedence depends on how many rows are still tied.
 */

import { createRng } from './random.js';
import {
  headToHead,
  headToHeadKey,
  recordFor,
  type EntrantRecord,
  type StandingsTable,
} from './standings.js';
import type { EntrantId } from './types.js';

export type TiebreakRule = 'headToHead' | 'setPct' | 'gamePct' | 'lots';

export interface TiebreakStep {
  /** The entrants that were tied when this rule was applied. */
  readonly tiedEntrants: readonly EntrantId[];
  readonly rule: TiebreakRule;
  /** Human-readable value per entrant. Displayed, never parsed. */
  readonly values: Readonly<Record<EntrantId, string>>;
  /** Entrants this step placed, in the order it placed them. */
  readonly resolved: readonly EntrantId[];
  /** True when the rule failed to fully separate and a subgroup remained. */
  readonly partial: boolean;
}

export interface RankedStanding extends EntrantRecord {
  readonly rank: number;
}

export interface RankedTable {
  readonly standings: readonly RankedStanding[];
  /** Every tiebreak applied, in the order applied. Empty when no ties occurred. */
  readonly trace: readonly TiebreakStep[];
}

export interface RankingConfig {
  readonly table: StandingsTable;
  /**
   * What orders the table before tiebreakers apply. ITF round robin uses
   * matches won; leagues that award points for a played loss want points.
   */
  readonly primary?: 'matchesWon' | 'points';
  /**
   * Seed for drawing lots. Lots are a real rule, not a fallback for bugs, and
   * seeding them keeps the result reproducible and auditable.
   */
  readonly randomSeed?: string;
}

/* ------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* ------------------------------------------------------------------------- */

function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function setValue(r: EntrantRecord): string {
  const total = r.setsWon + r.setsLost;
  return `${r.setsWon}/${total} sets (${asPercent(r.setPct)})`;
}

function gameValue(r: EntrantRecord): string {
  const total = r.gamesWon + r.gamesLost;
  return `${r.gamesWon}/${total} games (${asPercent(r.gamePct)})`;
}

/* ------------------------------------------------------------------------- */
/* Partitioning                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Split a group into blocks of equal key, ordered by key descending. One block
 * back means the criterion separated nobody.
 */
function partitionByDesc(
  group: readonly EntrantId[],
  keyOf: (id: EntrantId) => number,
): EntrantId[][] {
  const byKey = new Map<number, EntrantId[]>();
  for (const id of group) {
    const key = keyOf(id);
    const bucket = byKey.get(key);
    if (bucket === undefined) byKey.set(key, [id]);
    else bucket.push(id);
  }
  return [...byKey.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);
}

/**
 * Wins against the other members of this tie only.
 *
 * Head-to-head within a subgroup deliberately ignores results against entrants
 * already placed — a three-way tie is settled on how those three fared against
 * each other, not on who beat the runaway leader.
 */
function withinGroupWins(
  group: readonly EntrantId[],
  table: StandingsTable,
  id: EntrantId,
): number {
  let wins = 0;
  for (const other of group) {
    if (other === id) continue;
    wins += table.headToHeadWins.get(headToHeadKey(id, other)) ?? 0;
  }
  return wins;
}

/** Did everyone in the group play everyone else in it? */
function isRoundRobinComplete(group: readonly EntrantId[], table: StandingsTable): boolean {
  for (const a of group) {
    for (const b of group) {
      if (a === b) continue;
      const met =
        (table.headToHeadWins.get(headToHeadKey(a, b)) ?? 0) +
        (table.headToHeadWins.get(headToHeadKey(b, a)) ?? 0);
      if (met === 0) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------------- */
/* The cascade                                                               */
/* ------------------------------------------------------------------------- */

interface Context {
  readonly table: StandingsTable;
  readonly trace: TiebreakStep[];
  readonly randomSeed: string;
}

function resolve(group: readonly EntrantId[], ctx: Context): EntrantId[] {
  if (group.length <= 1) return [...group];
  if (group.length === 2) return resolveTwo(group[0] as EntrantId, group[1] as EntrantId, ctx);
  return resolveMany(group, ctx);
}

/** Two tied entrants: head-to-head first. */
function resolveTwo(a: EntrantId, b: EntrantId, ctx: Context): EntrantId[] {
  const net = headToHead(ctx.table, a, b);
  if (net !== 0) {
    const [winner, loser] = net > 0 ? [a, b] : [b, a];
    ctx.trace.push({
      tiedEntrants: [a, b],
      rule: 'headToHead',
      values: {
        [winner as EntrantId]: 'won the head-to-head',
        [loser as EntrantId]: 'lost the head-to-head',
      },
      resolved: [winner as EntrantId, loser as EntrantId],
      partial: false,
    });
    return [winner as EntrantId, loser as EntrantId];
  }

  const recordA = recordFor(ctx.table, a);
  const recordB = recordFor(ctx.table, b);

  // Reached when the pair split their meetings in a double round robin, or
  // when they are level on wins without having met at all.
  if (recordA.setPct !== recordB.setPct) {
    const order = recordA.setPct > recordB.setPct ? [a, b] : [b, a];
    ctx.trace.push({
      tiedEntrants: [a, b],
      rule: 'setPct',
      values: { [a]: setValue(recordA), [b]: setValue(recordB) },
      resolved: order,
      partial: false,
    });
    return order;
  }

  if (recordA.gamePct !== recordB.gamePct) {
    const order = recordA.gamePct > recordB.gamePct ? [a, b] : [b, a];
    ctx.trace.push({
      tiedEntrants: [a, b],
      rule: 'gamePct',
      values: { [a]: gameValue(recordA), [b]: gameValue(recordB) },
      resolved: order,
      partial: false,
    });
    return order;
  }

  return drawLots([a, b], ctx);
}

/** Three or more tied: percentages first, head-to-head last. */
function resolveMany(group: readonly EntrantId[], ctx: Context): EntrantId[] {
  // 1. Percentage of sets won across all matches in the group.
  const bySet = partitionByDesc(group, (id) => recordFor(ctx.table, id).setPct);
  if (bySet.length > 1) {
    ctx.trace.push({
      tiedEntrants: [...group],
      rule: 'setPct',
      values: Object.fromEntries(group.map((id) => [id, setValue(recordFor(ctx.table, id))])),
      resolved: bySet.filter((b) => b.length === 1).flat(),
      partial: bySet.some((b) => b.length > 1),
    });
    // Separated entrants are placed; each remaining subgroup restarts the
    // cascade, so a pair that drops out here is settled head-to-head.
    return bySet.flatMap((block) => resolve(block, ctx));
  }

  // 2. Percentage of games won across all matches in the group.
  const byGame = partitionByDesc(group, (id) => recordFor(ctx.table, id).gamePct);
  if (byGame.length > 1) {
    ctx.trace.push({
      tiedEntrants: [...group],
      rule: 'gamePct',
      values: Object.fromEntries(group.map((id) => [id, gameValue(recordFor(ctx.table, id))])),
      resolved: byGame.filter((b) => b.length === 1).flat(),
      partial: byGame.some((b) => b.length > 1),
    });
    return byGame.flatMap((block) => resolve(block, ctx));
  }

  // 3. Head-to-head among the still-tied, but only if it yields a complete
  //    order. A rock-paper-scissors cycle (a beat b beat c beat a) gives every
  //    entrant one win and resolves nothing, which is exactly why this sits
  //    below the percentages for groups of three or more.
  const wins = new Map(group.map((id) => [id, withinGroupWins(group, ctx.table, id)]));
  const distinct = new Set(wins.values()).size === group.length;
  if (distinct && isRoundRobinComplete(group, ctx.table)) {
    const order = [...group].sort((x, y) => (wins.get(y) ?? 0) - (wins.get(x) ?? 0));
    ctx.trace.push({
      tiedEntrants: [...group],
      rule: 'headToHead',
      values: Object.fromEntries(
        group.map((id) => [id, `${wins.get(id) ?? 0} wins within the tie`]),
      ),
      resolved: order,
      partial: false,
    });
    return order;
  }

  return drawLots(group, ctx);
}

/**
 * Last resort, and a real rule rather than a bug escape hatch. Seeded so the
 * same tie always resolves the same way and the draw can be audited.
 */
function drawLots(group: readonly EntrantId[], ctx: Context): EntrantId[] {
  // Sort before shuffling. The seed is already order-independent, but a shuffle
  // permutes *positions* -- so feeding it the group in arrival order would make
  // the outcome depend on the order an admin happened to type names in.
  const canonical = [...group].sort();
  const order = createRng(`${ctx.randomSeed}|lots|${canonical.join(',')}`).shuffle(canonical);
  ctx.trace.push({
    tiedEntrants: [...group],
    rule: 'lots',
    values: Object.fromEntries(order.map((id, i) => [id, `lot ${i + 1}`])),
    resolved: order,
    partial: false,
  });
  return order;
}

/* ------------------------------------------------------------------------- */
/* Entry point                                                               */
/* ------------------------------------------------------------------------- */

export function rankStandings(config: RankingConfig): RankedTable {
  const { table } = config;
  const primary = config.primary ?? 'matchesWon';
  const ctx: Context = {
    table,
    trace: [],
    randomSeed: config.randomSeed ?? 'opentennis',
  };

  const ids = table.records.map((r) => r.entrantId);
  const primaryOf = (id: EntrantId): number =>
    primary === 'points' ? recordFor(table, id).points : recordFor(table, id).matchesWon;

  const blocks = partitionByDesc(ids, primaryOf);
  const ordered = blocks.flatMap((block) => resolve(block, ctx));

  return {
    standings: ordered.map((entrantId, index) => ({
      ...recordFor(table, entrantId),
      rank: index + 1,
    })),
    trace: ctx.trace,
  };
}

/**
 * Why is `a` ranked above `b`? Returns the step that separated them, or null if
 * they were never tied in the first place.
 */
export function explainOrdering(
  ranked: RankedTable,
  a: EntrantId,
  b: EntrantId,
): TiebreakStep | null {
  return (
    ranked.trace.find(
      (step) => step.tiedEntrants.includes(a) && step.tiedEntrants.includes(b),
    ) ?? null
  );
}
