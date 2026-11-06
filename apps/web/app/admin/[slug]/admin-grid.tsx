'use client';

import { useActionState, useState } from 'react';
import {
  generateDrawForEvent,
  generateDraws,
  setEventFormat,
  setEventStatus,
  toggleEvent,
  type ActionState,
} from '../tournament-actions';
import styles from './manage.module.css';

export interface AdminCategory {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly rank: number;
}

export interface AdminEvent {
  readonly id: string;
  readonly categoryId: string;
  readonly discipline: string;
  readonly division: string;
  readonly format: string;
  readonly status: string;
  readonly entrantCount: number;
  readonly matchCount: number;
}

const DISCIPLINES = ['singles', 'doubles'] as const;

/**
 * Divisions are TABS rather than extra columns. Category x discipline x
 * division is 36 cells; showing them all at once would be a wall, and a club
 * running only open events should never have to look at the other two.
 */
const DIVISIONS = [
  // "Mixed", not "Open": the ladder's top category is also called Open, and
  // two different things called the same word on one screen is a trap. The
  // stored value stays `open` — this is a label, not a migration.
  { value: 'open', label: 'Mixed' },
  { value: 'mens', label: "Men's" },
  { value: 'womens', label: "Women's" },
] as const;

/** Round robin for the strong tiers, brackets for the rest. Defaults only. */
function defaultFormat(code: string): 'roundRobin' | 'singleElimination' {
  return ['Open', 'A', 'B'].includes(code) ? 'roundRobin' : 'singleElimination';
}

export function AdminGrid({
  slug,
  categories,
  events,
  entriesOpen,
  canManageDraws,
}: {
  readonly slug: string;
  readonly categories: readonly AdminCategory[];
  readonly events: readonly AdminEvent[];
  /** Draws cannot be made while people can still sign up. */
  readonly entriesOpen: boolean;
  /** INF-2. A scorekeeper or viewer is not offered draw controls at all. */
  readonly canManageDraws: boolean;
}) {
  const [division, setDivision] = useState<string>('open');
  const [genState, genAction, genPending] = useActionState<ActionState, FormData>(
    generateDraws,
    {},
  );

  const byKey = new Map(
    events.map((e) => [`${e.categoryId}:${e.discipline}:${e.division}`, e]),
  );
  const ordered = [...categories].sort((a, b) => a.rank - b.rank);
  const countFor = (d: string): number => events.filter((e) => e.division === d).length;

  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>Draws</h2>
        {/* Hidden rather than disabled while entries are open: a greyed
            button invites a click and then explains itself. The server
            refuses either way — this is only the honest front of it. */}
        {!canManageDraws ? null : entriesOpen ? (
          <p className={styles.hint}>
            Close registration to generate draws.
          </p>
        ) : (
          <form action={genAction}>
            <input type="hidden" name="slug" value={slug} />
            <button className={styles.submit} type="submit" disabled={genPending}>
              {genPending ? 'Generating…' : 'Generate all draws'}
            </button>
          </form>
        )}
      </div>

      {genState.ok !== undefined && <p className={styles.ok} role="status">{genState.ok}</p>}
      {genState.error !== undefined && <p className={styles.error} role="alert">{genState.error}</p>}

      <p className={styles.hint}>
        Tick a cell to run that category. Generating replaces any existing draw.
      </p>

      <div className={styles.divisionTabs} role="tablist" aria-label="Division">
        {DIVISIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            role="tab"
            aria-selected={division === d.value}
            className={styles.divisionTab}
            data-active={division === d.value}
            onClick={() => setDivision(d.value)}
          >
            {d.label}
            {countFor(d.value) > 0 && (
              <span className={styles.divisionCount}>{countFor(d.value)}</span>
            )}
          </button>
        ))}
      </div>

      {/* Wrapper so the grid, not the page, is what scrolls on a phone. */}
      <div className={styles.gridScroll}>
        <div className={styles.gridHead}>
          <span />
          <span className={styles.colLabel}>Singles</span>
          <span className={styles.colLabel}>Doubles</span>
        </div>

      {ordered.map((category) => (
        <div key={category.id} className={styles.gridRow}>
          <span className={styles.rowCode}>{category.code}</span>

          {DISCIPLINES.map((discipline) => {
            const event = byKey.get(`${category.id}:${discipline}:${division}`);
            const segment = division === 'open' ? discipline : `${division}-${discipline}`;

            if (event === undefined) {
              return (
                <form key={discipline} action={toggleEvent} className={styles.cellOff}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input type="hidden" name="discipline" value={discipline} />
                  <input type="hidden" name="division" value={division} />
                  <input type="hidden" name="format" value={defaultFormat(category.code)} />
                  <button className={styles.addCell} type="submit">+ Add</button>
                </form>
              );
            }

            return (
              <div key={discipline} className={styles.cellOn} data-status={event.status}>
                <div className={styles.cellTop}>
                  <form action={setEventFormat}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <select
                      className={styles.select}
                      name="format"
                      defaultValue={event.format}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    >
                      <option value="roundRobin">Round robin</option>
                      <option value="singleElimination">Single elim</option>
                    </select>
                  </form>
                  <span className={styles.cellCount}>
                    {event.entrantCount}
                    <span className={styles.cellUnit}>entr</span>
                    {event.matchCount > 0 && (
                      <>
                        {' '}
                        {event.matchCount}
                        <span className={styles.cellUnit}>mat</span>
                      </>
                    )}
                  </span>
                </div>

                <div className={styles.cellActions}>
                  {/* A dedicated page, not a panel crammed into the cell:
                      a list of forty entrants with seeds and payment state
                      needs a table, not a sidebar. */}
                  <a
                    className={styles.cellButton}
                    href={`/admin/${slug}/${category.slug}/${segment}`}
                  >
                    Entrants
                  </a>

                  {/* Three states, one button at most. Once a draw exists
                      there is NO regenerate here at all — replacing it is a
                      typed confirmation on the draw's own page, because the
                      old button silently deleted the bracket and its
                      results. */}
                  {!canManageDraws ? (
                    <span className={styles.cellState}>
                      {event.matchCount > 0 ? 'Drawn' : 'Not drawn'}
                    </span>
                  ) : event.matchCount > 0 ? (
                    <span className={styles.cellState}>Drawn</span>
                  ) : entriesOpen ? (
                    <span className={styles.cellState}>Entries open</span>
                  ) : (
                    <form action={generateDrawForEvent}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <button className={styles.cellButton} type="submit">Draw</button>
                    </form>
                  )}

                  <form action={setEventStatus}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={event.status === 'notRun' ? 'draft' : 'notRun'}
                    />
                    <button className={styles.cellButton} type="submit">
                      {event.status === 'notRun' ? 'Reopen' : 'Not held'}
                    </button>
                  </form>

                  <form action={toggleEvent}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input type="hidden" name="discipline" value={discipline} />
                    <input type="hidden" name="division" value={division} />
                    <button className={styles.cellRemove} type="submit" aria-label="Remove draw">
                      ×
                    </button>
                  </form>
                </div>

              </div>
            );
          })}
        </div>
      ))}
      </div>
    </section>
  );
}
