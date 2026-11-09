/**
 * Motion 9 — Court Loader (docs/design-system.md §5).
 *
 * "Not a spinner. A 6px optic-yellow ball traverses a bezier arc over a
 * 1px baseline, with a slight squash at the arc's low point."
 *
 * The keyframe (`ot-ball-arc`) has been in tokens.css since the design
 * system was written and nothing ever used it — the product had no loading
 * state at all, so a slow page was a blank one.
 *
 * This is the one place optic yellow appears without meaning "live right
 * now", and it is a deliberate exception rather than an oversight: the ball
 * IS the brand's object, and a loader is not a match. Every other use stays
 * reserved.
 *
 * Server component. A loading state that waits for hydration to appear is
 * a loading state that arrives after the thing it was covering.
 */

import styles from './court-loader.module.css';

export function CourtLoader({
  label,
  size = 'standalone',
}: {
  /** Announced, never drawn — the arc carries the meaning visually. */
  readonly label: string;
  readonly size?: 'inline' | 'standalone';
}) {
  return (
    <div className={styles.wrap} data-size={size} role="status" aria-live="polite">
      <div className={styles.court}>
        <span className={styles.ball} />
        <span className={styles.baseline} />
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
