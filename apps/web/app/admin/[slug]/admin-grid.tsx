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
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
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
  dict,
}: {
  readonly slug: string;
  readonly categories: readonly AdminCategory[];
  readonly events: readonly AdminEvent[];
  /** Draws cannot be made while people can still sign up. */
  readonly entriesOpen: boolean;
  /** INF-2. A scorekeeper or viewer is not offered draw controls at all. */
  readonly canManageDraws: boolean;
  readonly dict: Dictionary;
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

  /*
   * OT-9. How many draws the bulk action would actually make.
   *
   * Events marked "not held" are off the books and `generateDraws` skips
   * them, so counting them here would offer to generate draws that never
   * get made — the same denominator mistake that left the phase panel
   * stuck at "3 of 4 done" forever.
   */
  const running = events.filter((e) => e.status !== 'notRun');
  const drawn = running.filter((e) => e.matchCount > 0).length;
  const undrawn = running.length - drawn;
  const countFor = (d: string): number => events.filter((e) => e.division === d).length;
  const divisions = [
    // The stored value remains `open`; only the visible label is translated.
    { value: 'open', label: dict.mixedDivision },
    { value: 'mens', label: dict.divisionMensLabel },
    { value: 'womens', label: dict.divisionWomensLabel },
  ] as const;

  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>{dict.drawGrid}</h2>
        {/*
          Nothing at all while entries are open. The phase card above
          already says "close entries" and owns that message; saying it
          again here is how the page ended up with a panel asserting
          "entries are open" directly below one asking you to close them.
        */}
        {!canManageDraws || entriesOpen ? null : (
          <form action={genAction}>
            <input type="hidden" name="slug" value={slug} />
            {/*
              OT-9. The button says what it will actually do.

              QA expected this to need a "you are about to replace N
              results" confirmation. It does not, and that is worth stating
              plainly: `generateDraws` SKIPS any event that already has
              matches — it reports them and moves on. It used to call
              clearDraw() unconditionally, a second click destroyed a
              bracket and every result under it, and that is exactly why
              the skip exists. Replacing a draw is `redrawEvent`: its own
              page, a typed confirmation, and a refusal once any match has
              a winner.

              So there is no bulk replacement to gate, and inventing a
              confirmation for an action that cannot destroy anything would
              teach organizers to click through warnings that do not mean
              what they say. The real defect QA saw is that a button
              reading "Generate all draws" next to four finished draws
              looks like it will redo them. It now names the remainder,
              and disappears when there is no remainder.
            */}
            {undrawn === 0 ? (
              running.length > 0 && (
                <span className={styles.allDrawn}>{dict.allDrawsGenerated}</span>
              )
            ) : (
              <button className={styles.submit} type="submit" disabled={genPending}>
                {genPending
                  ? dict.generating
                  : drawn === 0
                    ? dict.generateAllDraws
                    : fill(dict.generateRemainingDraws, { n: String(undrawn) })}
              </button>
            )}
          </form>
        )}
      </div>

      {genState.ok !== undefined && <p className={styles.ok} role="status">{genState.ok}</p>}
      {genState.error !== undefined && <p className={styles.error} role="alert">{genState.error}</p>}

      <p className={styles.hint}>
        {/* "Generating replaces any existing draw" was true until draw
            generation became a one-way door; it now refuses rather than
            overwrites, and replacing one is a typed confirmation on the
            draw's own page. */}
        {dict.tickCellToRunCategory}
      </p>

      <div className={styles.divisionTabs} role="tablist" aria-label={dict.division}>
        {divisions.map((d) => (
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
          <span className={styles.colLabel}>{dict.singles}</span>
          <span className={styles.colLabel}>{dict.doubles}</span>
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
                  <select
                    className={styles.select}
                    name="format"
                    defaultValue={defaultFormat(category.code)}
                    aria-label={fill(dict.formatFor, {
                      category: category.code,
                      discipline: discipline === 'singles' ? dict.singles : dict.doubles,
                    })}
                  >
                    <option value="roundRobin">{dict.roundRobin}</option>
                    <option value="singleElimination">{dict.singleElim}</option>
                  </select>
                  <button className={styles.addCell} type="submit">+ {dict.add}</button>
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
                      <option value="roundRobin">{dict.roundRobin}</option>
                      <option value="singleElimination">{dict.singleElim}</option>
                    </select>
                  </form>
                  <span className={styles.cellCount}>
                    {event.entrantCount}
                    <span className={styles.cellUnit}>{dict.entrantsShort}</span>
                    {event.matchCount > 0 && (
                      <>
                        {' '}
                        {event.matchCount}
                        <span className={styles.cellUnit}>{dict.matchesShort}</span>
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
                    {dict.entrants}
                  </a>

                  {/* Three states, one button at most. Once a draw exists
                      there is NO regenerate here at all — replacing it is a
                      typed confirmation on the draw's own page, because the
                      old button silently deleted the bracket and its
                      results. */}
                  {!canManageDraws ? (
                    <span className={styles.cellState}>
                      {event.matchCount > 0 ? dict.drawn : dict.notDrawn}
                    </span>
                  ) : event.matchCount > 0 ? (
                    <span className={styles.cellState}>{dict.drawn}</span>
                  ) : entriesOpen ? (
                    <span className={styles.cellState}>{dict.entriesOpenLabel}</span>
                  ) : (
                    <form action={generateDrawForEvent}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <button className={styles.cellButton} type="submit">{dict.drawAction}</button>
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
                      {event.status === 'notRun' ? dict.reopen : dict.notHeld}
                    </button>
                  </form>

                  <form action={toggleEvent}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input type="hidden" name="discipline" value={discipline} />
                    <input type="hidden" name="division" value={division} />
                    <button className={styles.cellRemove} type="submit" aria-label={dict.removeDraw}>
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
