import { listEntrants, removeEntrant, togglePaid } from '../tournament-actions';
import styles from './manage.module.css';

/**
 * Entrants for one draw.
 *
 * A server component rendered inside the grid cell, so the list is always
 * current after a registration lands — no client cache to invalidate.
 *
 * The paid tick is the organizer's only per-entrant job. Everything else
 * about an entry arrives from the player.
 */
export async function EntrantList({
  slug,
  eventId,
}: {
  readonly slug: string;
  readonly eventId: string;
}) {
  const entrants = await listEntrants(eventId);
  if (entrants.length === 0) {
    return <p className={styles.hint}>Nobody has entered yet.</p>;
  }

  const unpaid = entrants.filter((e) => !e.paid).length;

  return (
    <div className={styles.entrants}>
      <p className={styles.entrantsHead}>
        {entrants.length} entered
        {unpaid > 0 && <span className={styles.unpaidCount}> · {unpaid} unpaid</span>}
      </p>

      <ul className={styles.entrantList}>
        {entrants.map((e) => (
          <li key={e.id} className={styles.entrantRow} data-paid={e.paid}>
            <form action={togglePaid} className={styles.paidForm}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="entrantId" value={e.id} />
              <input type="hidden" name="paid" value={String(!e.paid)} />
              <button
                type="submit"
                className={styles.paidTick}
                data-paid={e.paid}
                aria-label={e.paid ? `Mark ${e.name} unpaid` : `Mark ${e.name} paid`}
                title={e.paid ? 'Paid — click to undo' : 'Not paid — click to mark paid'}
              >
                {e.paid ? '✓' : ''}
              </button>
            </form>

            <span className={styles.entrantName}>
              {e.name === '' ? '(no name)' : e.name}
              {!e.selfRegistered && <span className={styles.addedBy}>added by admin</span>}
            </span>

            {e.email !== null && <span className={styles.entrantContact}>{e.email}</span>}

            <form action={removeEntrant}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="entrantId" value={e.id} />
              <button className={styles.cellRemove} type="submit" aria-label={`Remove ${e.name}`}>
                ×
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
