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
  readonly division: string;
  readonly status: string;
}

/** 'open' contributes no prefix, so pre-division URLs keep working. */
function segment(division: string, discipline: string): string {
  return division === 'open' ? discipline : `${division}-${discipline}`;
}

export interface SwitcherLabels {
  readonly draws: string;
  readonly singlesShort: string;
  readonly doublesShort: string;
  readonly singles: string;
  readonly doubles: string;
}

const DEFAULT_LABELS: SwitcherLabels = {
  draws: 'Draws',
  singlesShort: 'S',
  doublesShort: 'D',
  singles: 'Singles',
  doubles: 'Doubles',
};

export function DrawSwitcher({
  tournamentSlug,
  draws,
  activeCategorySlug,
  activeDiscipline,
  labels = DEFAULT_LABELS,
}: {
  readonly tournamentSlug: string;
  readonly draws: readonly DrawLink[];
  readonly activeCategorySlug: string;
  readonly activeDiscipline: string;
  readonly labels?: SwitcherLabels;
}): ReactNode {
  // Ladder order, never alphabetical: A, B, C, C+, D, Open reads as broken.
  const ordered = [...draws].sort(
    (a, b) =>
      a.rank - b.rank ||
      a.division.localeCompare(b.division) ||
      a.discipline.localeCompare(b.discipline),
  );

  return (
    <nav className={styles.bar} aria-label={labels.draws}>
      <span className={styles.label}>{labels.draws}</span>
      <div className={styles.scroller}>
        {ordered.map((d) => {
          const seg = segment(d.division, d.discipline);
          const active = d.categorySlug === activeCategorySlug && seg === activeDiscipline;
          const unavailable = d.status === 'notRun' || d.status === 'draft';
          const content = (
            <>
              <span className={styles.code}>{d.categoryCode}</span>
              <span className={styles.discipline}>
                {d.division === 'mens' ? 'M' : d.division === 'womens' ? 'F' : ''}
                {d.discipline === 'singles' ? labels.singlesShort : labels.doublesShort}
              </span>
            </>
          );

          if (unavailable) {
            return (
              <span key={`${d.categorySlug}-${seg}`} className={styles.chip} data-disabled="true">
                {content}
              </span>
            );
          }

          return (
            <Link
              key={`${d.categorySlug}-${seg}`}
              href={`/t/${tournamentSlug}/${d.categorySlug}/${seg}`}
              className={styles.chip}
              data-active={active}
              aria-label={`${d.categoryCode} ${d.discipline === 'singles' ? labels.singles : labels.doubles}`}
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
