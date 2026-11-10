'use client';

import { useActionState, useState } from 'react';
import { addEntrants, type ActionState } from '../../../tournament-actions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './entrants.module.css';

/**
 * Manual entry, collapsed by default.
 *
 * Self-registration is the main path, so this is secondary chrome rather
 * than the first thing on the page — but it stays, for the person who turns
 * up on the day without having registered.
 */
export function AddEntrants({
  slug,
  eventId,
  isDoubles,
  dict,
}: {
  readonly slug: string;
  readonly eventId: string;
  readonly isDoubles: boolean;
  readonly dict: Dictionary;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addEntrants, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className={styles.disclosure} onClick={() => setOpen(true)}>
        + {dict.addEntrantsManually}
      </button>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.panelTitle}>Add entrants</h2>
        <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <form action={action} className={styles.addForm}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={eventId} />
        <label className={styles.field}>
          <span className={styles.label}>
            {isDoubles ? 'One team per line — "Partner A / Partner B"' : 'One name per line'}
          </span>
          <textarea
            className={styles.textarea}
            name="names"
            rows={6}
            placeholder={
              isDoubles
                ? 'Priya Raman / Marco Silva\nDana Chen / Sam Okonkwo'
                : 'Priya Raman\nMarco Silva\nDana Chen'
            }
          />
        </label>

        {state.ok !== undefined && <p className={styles.ok} role="status">{state.ok}</p>}
        {state.error !== undefined && <p className={styles.error} role="alert">{state.error}</p>}

        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </form>
    </section>
  );
}
