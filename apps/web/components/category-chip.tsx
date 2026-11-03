/**
 * DES-5: category chip and rank ticks.
 *
 * A tournament runs up to twelve draws at once (six categories × two
 * disciplines), so category is a primary navigational axis and appears on
 * nearly every surface.
 *
 * CATEGORIES ARE NEVER COLOUR-CODED. Six categories invites six hues, which
 * would wreck the one-accent rule and leave the palette meaningless. Category
 * is expressed typographically and positionally instead:
 *
 *   ╷╷╷╷╷╷   OPEN      ← rank ticks: filled = position in the ladder
 *   ╷╷╷╷╷    A
 *   ╷╷╷╷     B
 *   ╷╷╷      C+
 *   ╷╷       C
 *   ╷        D
 *
 * The ticks are decorative only and always accompany the text code, never
 * replace it.
 */

import type { ReactNode } from 'react';
import styles from './category-chip.module.css';

export const LADDER_SIZE = 6;

export interface CategoryChipProps {
  /** "Open", "A", "C+". Displayed verbatim. */
  readonly code: string;
  /** Ladder position, 1 = strongest. Drives the tick indicator. */
  readonly rank?: number;
  /** Total ladder length, in case an org has more or fewer than six tiers. */
  readonly ladderSize?: number;
  readonly showTicks?: boolean;
  readonly size?: 'sm' | 'md';
}

/**
 * Relative ladder position without a legend or a colour key. Filled to the
 * category's rank, counting from the weakest so that stronger categories show
 * more ticks — which is the intuition people already have.
 */
export function RankTicks({
  rank,
  ladderSize = LADDER_SIZE,
}: {
  readonly rank: number;
  readonly ladderSize?: number;
}): ReactNode {
  const filled = Math.max(0, ladderSize - rank + 1);
  return (
    <span className={styles.ticks} aria-hidden="true">
      {Array.from({ length: ladderSize }, (_, i) => (
        <span key={i} className={styles.tick} data-filled={i < filled} />
      ))}
    </span>
  );
}

export function CategoryChip({
  code,
  rank,
  ladderSize = LADDER_SIZE,
  showTicks = false,
  size = 'md',
}: CategoryChipProps): ReactNode {
  return (
    <span className={styles.wrap}>
      {showTicks && rank !== undefined && <RankTicks rank={rank} ladderSize={ladderSize} />}
      {/* Identical styling for every category — no per-category colour. */}
      <span className={styles.chip} data-size={size}>
        {code}
      </span>
    </span>
  );
}

/**
 * Discipline is a SEPARATE chip, not fused into the category: they are two
 * independent dimensions and the UI filters on each separately.
 */
export function DisciplineChip({
  discipline,
  size = 'md',
  label,
}: {
  readonly discipline: 'singles' | 'doubles';
  readonly size?: 'sm' | 'md';
  readonly label?: string;
}): ReactNode {
  return (
    <span className={styles.chip} data-size={size} data-muted="true">
      {label ?? (discipline === 'singles' ? 'Singles' : 'Doubles')}
    </span>
  );
}

/**
 * Pending count for the review queue, shown on a grid cell.
 *
 * Deliberately NOT optic yellow: pending is not live, and optic yellow means
 * exactly one thing.
 */
export function PendingBadge({ count }: { readonly count: number }): ReactNode {
  if (count <= 0) return null;
  return (
    <span className={styles.pending}>
      {count} pending
    </span>
  );
}

/** Live indicator. The only place optic yellow is permitted. */
export function LiveDot(): ReactNode {
  return (
    <span className={styles.liveWrap}>
      <span className={styles.liveDot} aria-hidden="true" />
      <span className={styles.liveText}>Live</span>
    </span>
  );
}
