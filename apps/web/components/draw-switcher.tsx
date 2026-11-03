/**
 * Category switcher, available inside every draw.
 *
 * With up to twelve draws per tournament, moving between them must not mean
 * going back to the landing page. Tap-only by design: horizontal swipe is
 * already claimed by round navigation inside a bracket, and overloading one
 * gesture with two meanings is how a bracket becomes unusable.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './draw-switcher.module.css';

export interface DrawLink {
  readonly categorySlug: string;
  readonly categoryCode: string;
  readonly rank: number;
  readonly discipline: string;
  readonly status: string;
}

export function DrawSwitcher({
  tournamentSlug,
  draws,
  activeCategorySlug,
  activeDiscipline,
}: {
  readonly tournamentSlug: string;
  readonly draws: readonly DrawLink[];
  readonly activeCategorySlug: string;
  readonly activeDiscipline: string;
}): ReactNode {
  // Ladder order, never alphabetical: A, B, C, C+, D, Open reads as broken.
  const ordered = [...draws].sort(
    (a, b) => a.rank - b.rank || a.discipline.localeCompare(b.discipline),
  );

  return (
    <nav className={styles.bar} aria-label="Other draws">
      <span className={styles.label}>Draws</span>
      <div className={styles.scroller}>
        {ordered.map((d) => {
          const active = d.categorySlug === activeCategorySlug && d.discipline === activeDiscipline;
          const unavailable = d.status === 'notRun' || d.status === 'draft';
          const content = (
            <>
              <span className={styles.code}>{d.categoryCode}</span>
              <span className={styles.discipline}>
                {d.discipline === 'singles' ? 'S' : 'D'}
              </span>
            </>
          );

          if (unavailable) {
            return (
              <span key={`${d.categorySlug}-${d.discipline}`} className={styles.chip} data-disabled="true">
                {content}
              </span>
            );
          }

          return (
            <Link
              key={`${d.categorySlug}-${d.discipline}`}
              href={`/t/${tournamentSlug}/${d.categorySlug}/${d.discipline}`}
              className={styles.chip}
              data-active={active}
              aria-current={active ? 'page' : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
