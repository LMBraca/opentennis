/**
 * DES-6: the category grid.
 *
 * Shared between the admin setup screen and the public landing page — same
 * geometry, different affordances. Categories as rows against the page's left
 * rule, disciplines as columns.
 *
 * On a phone this collapses to a vertical list grouped by category, NOT a
 * horizontally scrolling table. It is the primary navigation and must not
 * require a sideways swipe to use.
 *
 * Ladder order is enforced by `rank`, never alphabetically. An alphabetical
 * sort yielding A, B, C, C+, D, Open reads as broken to anyone who plays.
 */

'use client';

import type { ReactNode } from 'react';
import { CategoryChip, DisciplineChip, LiveDot, PendingBadge } from './category-chip';
import { isOfferedButNotGenerated } from '@/lib/category-grid-state';
import styles from './category-grid.module.css';

export type Discipline = 'singles' | 'doubles';

export type CellStatus =
  | 'draft'
  | 'ready'
  | 'published'
  | 'inProgress'
  | 'complete'
  | 'notRun'
  /** Never offered. Visually distinct from notRun, which means "cancelled". */
  | 'absent';

export interface GridCategory {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly rank: number;
}

export interface GridCell {
  readonly categoryId: string;
  readonly discipline: Discipline;
  readonly status: CellStatus;
  readonly format?: 'singleElimination' | 'roundRobin' | 'hybrid';
  readonly entrantCount?: number;
  readonly pendingCount?: number;
  readonly liveCount?: number;
  readonly hasDraw?: boolean;
  readonly href?: string;
}

/** Translated strings. Passed in so this stays a pure presentational component. */
export interface GridLabels {
  readonly singles: string;
  readonly doubles: string;
  readonly entrant: string;
  readonly entrants: string;
  readonly roundRobin: string;
  readonly singleElim: string;
  readonly groupsPlayoff: string;
  readonly notHeld: string;
  readonly noDraws: string;
  readonly notGenerated: string;
}

const DEFAULT_LABELS: GridLabels = {
  singles: 'Singles',
  doubles: 'Doubles',
  entrant: 'Entrant',
  entrants: 'Entrants',
  roundRobin: 'Round robin',
  singleElim: 'Single elim',
  groupsPlayoff: 'Groups → playoff',
  notHeld: 'Not held',
  noDraws: 'No draws have been published yet.',
  notGenerated: 'This draw has not been generated yet.',
};

export interface CategoryGridProps {
  readonly categories: readonly GridCategory[];
  readonly cells: readonly GridCell[];
  /** 'public' hides absent and notRun cells; 'admin' shows every cell. */
  readonly mode?: 'public' | 'admin';
  readonly onToggleCell?: (categoryId: string, discipline: Discipline) => void;
  readonly onOpenCell?: (cell: GridCell) => void;
  /** Show notRun cells greyed with a "not held" label rather than hiding them. */
  readonly showNotRun?: boolean;
  readonly labels?: GridLabels;
}

const DISCIPLINES: readonly Discipline[] = ['singles', 'doubles'];

function cellKey(categoryId: string, discipline: Discipline): string {
  return `${categoryId}:${discipline}`;
}

function CellBody({ cell, labels }: { readonly cell: GridCell; readonly labels: GridLabels }): ReactNode {
  if (cell.status === 'absent') {
    return <span className={styles.cellEmpty}>—</span>;
  }

  if (cell.status === 'notRun') {
    // Distinct from absent: this one was offered and then not held, so
    // entrants who registered are not left wondering.
    return <span className={styles.notHeld}>{labels.notHeld}</span>;
  }

  const underFilled =
    cell.entrantCount !== undefined && cell.entrantCount > 0 && cell.entrantCount < 4;

  return (
    <>
      <span className={styles.cellMain}>
        <span className={styles.cellFormat}>
          {cell.format === undefined
            ? ''
            : cell.format === 'roundRobin'
              ? labels.roundRobin
              : cell.format === 'singleElimination'
                ? labels.singleElim
                : labels.groupsPlayoff}
        </span>
        {cell.hasDraw === false && <span className={styles.notGenerated}>{labels.notGenerated}</span>}
        <span className={styles.cellMeta}>
          {cell.liveCount !== undefined && cell.liveCount > 0 && <LiveDot />}
          {cell.pendingCount !== undefined && cell.pendingCount > 0 && (
            <PendingBadge count={cell.pendingCount} />
          )}
        </span>
      </span>
      {cell.entrantCount !== undefined && (
        <span className={styles.count} data-under-filled={underFilled}>
          {cell.entrantCount}
          <span className={styles.countUnit}>
            {cell.entrantCount === 1 ? labels.entrant : labels.entrants}
          </span>
        </span>
      )}
    </>
  );
}

export function CategoryGrid({
  categories,
  cells,
  mode = 'public',
  onToggleCell,
  onOpenCell,
  showNotRun = false,
  labels = DEFAULT_LABELS,
}: CategoryGridProps): ReactNode {
  // Ladder order, always. Sorting by code would yield A, B, C, C+, D, Open.
  const ordered = [...categories].sort((a, b) => a.rank - b.rank);
  const byKey = new Map(cells.map((c) => [cellKey(c.categoryId, c.discipline), c]));

  const cellFor = (categoryId: string, discipline: Discipline): GridCell =>
    byKey.get(cellKey(categoryId, discipline)) ?? {
      categoryId,
      discipline,
      status: 'absent',
    };

  const isHidden = (cell: GridCell): boolean => {
    if (mode === 'admin') return false;
    if (cell.status === 'absent') return true;
    if (cell.status === 'notRun') return !showNotRun;
    if (
      cell.status === 'draft' &&
      !isOfferedButNotGenerated(
        cell.status,
        cell.hasDraw === false ? 0 : 1,
        cell.entrantCount ?? 0,
      )
    ) return true;
    return false;
  };

  const visibleCategories = ordered.filter((category) =>
    mode === 'admin'
      ? true
      : DISCIPLINES.some((d) => !isHidden(cellFor(category.id, d))),
  );

  if (visibleCategories.length === 0) {
    return (
      <p className={styles.empty}>
        {labels.noDraws}
      </p>
    );
  }

  const interactive = (cell: GridCell): boolean =>
    cell.status !== 'absent' && cell.status !== 'notRun' && (onOpenCell !== undefined || cell.href !== undefined);

  const renderCell = (cell: GridCell): ReactNode => {
    const canToggle = mode === 'admin' && onToggleCell !== undefined;
    const enabled = cell.status !== 'absent';

    if (canToggle) {
      return (
        <button
          type="button"
          className={styles.cell}
          data-status={cell.status}
          data-enabled={enabled}
          onClick={() => onToggleCell(cell.categoryId, cell.discipline)}
          aria-pressed={enabled}
        >
          <CellBody cell={cell} labels={labels} />
        </button>
      );
    }

    if (interactive(cell)) {
      return (
        <a
          className={styles.cell}
          data-status={cell.status}
          data-enabled={enabled}
          href={cell.href}
          onClick={
            onOpenCell === undefined
              ? undefined
              : (e) => {
                  e.preventDefault();
                  onOpenCell(cell);
                }
          }
        >
          <CellBody cell={cell} labels={labels} />
        </a>
      );
    }

    return (
      <div className={styles.cell} data-status={cell.status} data-enabled={enabled}>
        <CellBody cell={cell} labels={labels} />
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      {/* Desktop: a true grid with column headers. */}
      <div className={styles.grid} role="table" aria-label="Draws by category and discipline">
        <div className={styles.headRow} role="row">
          <div className={styles.headCorner} role="columnheader" />
          {DISCIPLINES.map((d) => (
            <div key={d} className={styles.headCell} role="columnheader">
              {d === 'singles' ? labels.singles : labels.doubles}
            </div>
          ))}
        </div>

        {visibleCategories.map((category) => (
          <div key={category.id} className={styles.row} role="row">
            <div className={styles.rowHead} role="rowheader">
              <span className={styles.categoryCode}>{category.code}</span>
            </div>
            {DISCIPLINES.map((d) => (
              <div key={d} className={styles.cellWrap} role="cell">
                {renderCell(cellFor(category.id, d))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/*
        Phone: a vertical list grouped by category. Not a horizontally
        scrolling table — this is the primary navigation.
      */}
      <div className={styles.stack}>
        {visibleCategories.map((category) => {
          const visible = DISCIPLINES.map((d) => cellFor(category.id, d)).filter(
            (c) => mode === 'admin' || !isHidden(c),
          );
          if (visible.length === 0) return null;

          return (
            <section key={category.id} className={styles.stackGroup}>
              <h3 className={styles.stackHead}>
                <CategoryChip code={category.code} rank={category.rank} showTicks />
              </h3>
              {visible.map((cell) => (
                <div key={cell.discipline} className={styles.stackRow}>
                  <DisciplineChip discipline={cell.discipline} label={cell.discipline === 'singles' ? labels.singles : labels.doubles} />
                  {renderCell(cell)}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
