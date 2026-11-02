/**
 * DB-9: default seed data.
 *
 * The category ladder ships as a preset rather than being hardcoded anywhere,
 * because an organization can rename tiers, add them, or reorder them — and
 * every tournament then selects from their ladder.
 */

import { slugifyCategoryCode } from './slugs';

export interface CategorySeed {
  readonly code: string;
  readonly slug: string;
  readonly rank: number;
  readonly label: string;
}

/**
 * `Open, A, B, C+, C, D`, strongest first.
 *
 * `rank` ascends from the strongest and drives display order everywhere. The
 * alternative — sorting by code — yields `A, B, C, C+, D, Open`, which reads
 * as broken to anyone who plays.
 */
export const DEFAULT_CATEGORY_LADDER: readonly CategorySeed[] = [
  { code: 'Open', rank: 1, label: 'Open' },
  { code: 'A', rank: 2, label: 'A' },
  { code: 'B', rank: 3, label: 'B' },
  { code: 'C+', rank: 4, label: 'C plus' },
  { code: 'C', rank: 5, label: 'C' },
  { code: 'D', rank: 6, label: 'D' },
].map((c) => ({ ...c, slug: slugifyCategoryCode(c.code) }));

/**
 * Default format per category, as a suggestion for a new tournament's grid.
 *
 * The stronger tiers draw few enough entrants that a round robin gives
 * everyone several matches; the lower tiers fill up and need a bracket. These
 * are DEFAULTS the admin overrides per cell, never rules — which is why they
 * live in seed data rather than in the engine.
 */
export const DEFAULT_FORMAT_BY_CATEGORY: Readonly<Record<string, 'roundRobin' | 'singleElimination'>> =
  {
    Open: 'roundRobin',
    A: 'roundRobin',
    B: 'roundRobin',
    'C+': 'singleElimination',
    C: 'singleElimination',
    D: 'singleElimination',
  };
