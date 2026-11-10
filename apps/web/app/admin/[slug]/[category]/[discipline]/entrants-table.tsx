'use client';

import { useActionState, useMemo, useState } from 'react';
import { removeEntrant, togglePaid } from '../../../tournament-actions';
import { clearSeeds, saveSeeds, setAllPaid, type SeedState } from './actions';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import styles from './entrants.module.css';

export interface Row {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly paid: boolean;
  readonly seed: number | null;
  readonly selfRegistered: boolean;
  readonly source: string | null;
  readonly payment: 'paid' | 'pending' | 'unpaid';
  readonly paymentMethod: string | null;
}

export function EntrantsTable({
  slug,
  eventId,
  entrants,
  isDoubles,
  dict,
}: {
  readonly slug: string;
  readonly eventId: string;
  readonly entrants: readonly Row[];
  readonly isDoubles: boolean;
  readonly dict: Dictionary;
}) {
  const [state, action, pending] = useActionState<SeedState, FormData>(saveSeeds, {});
  const [query, setQuery] = useState('');

  /*
   * Seeded entrants first in seed order, then everyone else by name. The
   * boundary between the two is drawn as a rule in the table, which is how a
   * paper draw sheet shows it: a visible line where seeding stops.
   */
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (r: Row) =>
      q === '' ||
      r.name.toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q);

    return [...entrants].filter(matches).sort((a, b) => {
      if (a.seed !== null && b.seed !== null) return a.seed - b.seed;
      if (a.seed !== null) return -1;
      if (b.seed !== null) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [entrants, query]);

  // The index of the last seeded row, or -1. Written out rather than using
  // findLastIndex, which would need the es2023 lib for one call.
  let lastSeededIndex = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]?.seed !== null) lastSeededIndex = i;
  }

  if (entrants.length === 0) {
    return (
      <section className={styles.panel}>
        <p className={styles.empty}>
          Nobody has entered yet. Share the registration link, or add entrants below.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search entrants"
        />
        <div className={styles.toolbarActions}>
          <form action={setAllPaid}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="paid" value="true" />
            <button className={styles.ghost} type="submit">Mark all paid</button>
          </form>
          <form action={clearSeeds}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="eventId" value={eventId} />
            <button className={styles.ghost} type="submit">Clear seeds</button>
          </form>
        </div>
      </div>
      <h2 className={styles.panelTitle}>{dict.separatePlayers}</h2>

      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={eventId} />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thSeed} scope="col">{dict.entrantsSeed}</th>
                <th scope="col">{isDoubles ? dict.team : dict.entrantsName}</th>
                <th className={styles.thContact} scope="col">{dict.entrantsContact}</th>
                <th className={styles.thPaid} scope="col">{dict.entrantsPaid}</th>
                <th className={styles.thActions} scope="col"><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.id}
                  className={styles.row}
                  // The rule under the last seeded row is the seeding line.
                  data-seed-boundary={i === lastSeededIndex && i < sorted.length - 1}
                >
                  <td className={styles.tdSeed}>
                    <input
                      className={styles.seedInput}
                      name={`seed:${r.id}`}
                      type="number"
                      min={1}
                      max={entrants.length}
                      inputMode="numeric"
                      defaultValue={r.seed ?? ''}
                      aria-label={fill(dict.seedForEntrant, { name: r.name })}
                      placeholder="–"
                    />
                  </td>

                  <td className={styles.tdName}>
                    <span className={styles.name}>{r.name === '' ? '(no name)' : r.name}</span>
                    {!r.selfRegistered && <span className={styles.tag}>added by admin</span>}
                    {/* Which QR code or link brought them in, when known. */}
                    {r.source !== null && <span className={styles.tag}>via {r.source}</span>}
                  </td>

                  <td className={styles.tdContact}>
                    {r.email === null ? (
                      <span className={styles.muted}>—</span>
                    ) : (
                      <>
                        <span className={styles.contactLine}>{r.email}</span>
                        {r.phone !== null && (
                          <span className={styles.contactLine}>{r.phone}</span>
                        )}
                      </>
                    )}
                  </td>

                  <td className={styles.tdPaid}>
                    {/* A nested form would be invalid HTML, so the paid tick
                        posts to its own action via the form attribute. */}
                    <button
                      className={styles.tick}
                      data-state={r.payment}
                      type="submit"
                      form={`paid-${r.id}`}
                      aria-label={r.paid ? `Mark ${r.name} unpaid` : `Mark ${r.name} paid`}
                      title={
                        r.payment === 'pending'
                          ? `Awaiting ${r.paymentMethod ?? 'payment'} — click to mark paid anyway`
                          : r.paid
                            ? 'Paid — click to undo'
                            : 'Not paid — click to mark paid'
                      }
                    >
                      {r.payment === 'paid' ? '✓' : r.payment === 'pending' ? '•' : ''}
                    </button>
                    {/* Pending is the state a boolean cannot express: the
                        player has committed, the money has not landed. */}
                    {r.payment === 'pending' && (
                      <span className={styles.pendingTag}>{r.paymentMethod}</span>
                    )}
                  </td>

                  <td className={styles.tdActions}>
                    <button
                      className={styles.remove}
                      type="submit"
                      form={`remove-${r.id}`}
                      aria-label={`Remove ${r.name}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {state.ok !== undefined && <p className={styles.ok} role="status">{state.ok}</p>}
        {state.error !== undefined && <p className={styles.error} role="alert">{state.error}</p>}

        <div className={styles.footer}>
          <button className={styles.primary} type="submit" disabled={pending}>
            {pending ? dict.saving : dict.saveSeeds}
          </button>
          <p className={styles.footNote}>
            {dict.seedSeparationHint}
          </p>
        </div>
      </form>

      {/* Sibling forms, referenced by the buttons above. Keeps the markup
          valid: a form cannot be nested inside another form. */}
      {sorted.map((r) => (
        <div key={`forms-${r.id}`} hidden>
          <form id={`paid-${r.id}`} action={togglePaid}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="entrantId" value={r.id} />
            <input type="hidden" name="paid" value={String(!r.paid)} />
          </form>
          <form id={`remove-${r.id}`} action={removeEntrant}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="entrantId" value={r.id} />
          </form>
        </div>
      ))}
    </section>
  );
}
