'use client';

import { useActionState, useState } from 'react';
import type React from 'react';
import {
  addEntrants,
  clearEntrants,
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
  { value: 'open', label: 'Open' },
  { value: 'mens', label: "Men's" },
  { value: 'womens', label: "Women's" },
] as const;

/** Round robin for the strong tiers, brackets for the rest. Defaults only. */
function defaultFormat(code: string): 'roundRobin' | 'singleElimination' {
  return ['Open', 'A', 'B'].includes(code) ? 'roundRobin' : 'singleElimination';
}

function EntrantPanel({
  slug,
  event,
  label,
  onClose,
  list,
}: {
  readonly slug: string;
  readonly event: AdminEvent;
  readonly label: string;
  readonly onClose: () => void;
  readonly list: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addEntrants, {});

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{label}</h3>
        <button type="button" className={styles.close} onClick={onClose}>Close</button>
      </div>

      {list}

      <form action={action} className={styles.panelForm}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={event.id} />
        <label className={styles.field}>
          <span className={styles.label}>
            {event.discipline === 'doubles'
              ? 'One team per line — "Partner A / Partner B"'
              : 'One name per line'}
          </span>
          <textarea
            className={styles.textarea}
            name="names"
            rows={7}
            placeholder={
              event.discipline === 'doubles'
                ? 'Priya Raman / Marco Silva\nDana Chen / Sam Okonkwo'
                : 'Priya Raman\nMarco Silva\nDana Chen'
            }
          />
        </label>

        {state.ok !== undefined && <p className={styles.ok} role="status">{state.ok}</p>}
        {state.error !== undefined && <p className={styles.error} role="alert">{state.error}</p>}

        <div className={styles.panelActions}>
          <button className={styles.submit} type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add entrants'}
          </button>
        </div>
      </form>

      <form action={clearEntrants} className={styles.panelActions}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={event.id} />
        <button className={styles.ghost} type="submit">
          Remove all {event.entrantCount} entrants
        </button>
      </form>
    </div>
  );
}

export function AdminGrid({
  slug,
  categories,
  events,
  entrantLists,
}: {
  readonly slug: string;
  readonly categories: readonly AdminCategory[];
  readonly events: readonly AdminEvent[];
  /** Server-rendered entrant lists, keyed by event id. */
  readonly entrantLists: Readonly<Record<string, React.ReactNode>>;
}) {
  const [open, setOpen] = useState<string | null>(null);
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
        <form action={genAction}>
          <input type="hidden" name="slug" value={slug} />
          <button className={styles.submit} type="submit" disabled={genPending}>
            {genPending ? 'Generating…' : 'Generate all draws'}
          </button>
        </form>
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
            const key = `${category.id}:${discipline}:${division}`;

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
                        {' · '}
                        {event.matchCount}
                        <span className={styles.cellUnit}>mat</span>
                      </>
                    )}
                  </span>
                </div>

                <div className={styles.cellActions}>
                  <button
                    type="button"
                    className={styles.cellButton}
                    onClick={() => setOpen(open === key ? null : key)}
                  >
                    Entrants
                  </button>

                  <form action={generateDrawForEvent}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <button className={styles.cellButton} type="submit">Draw</button>
                  </form>

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

                {open === key && (
                  <EntrantPanel
                    slug={slug}
                    event={event}
                    label={`${category.code}${
                      division === 'open' ? '' : division === 'mens' ? " Men's" : " Women's"
                    } ${discipline === 'singles' ? 'Singles' : 'Doubles'}`}
                    onClose={() => setOpen(null)}
                    list={entrantLists[event.id]}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
