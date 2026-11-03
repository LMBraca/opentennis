'use client';

import { useActionState } from 'react';
import { createTournament, type ActionState } from '../tournament-actions';
import styles from '../[slug]/schedule/schedule.module.css';

export function NewTournamentForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTournament, {});

  return (
    <form action={action} className={styles.form}>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Details</h2>

        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input className={styles.input} name="name" required autoFocus
                 placeholder="Open Tennis Summer Championship" />
        </label>

        <label className={styles.field} style={{ marginTop: 'var(--space-4)' }}>
          <span className={styles.label}>Venue</span>
          <input className={styles.input} name="venue" defaultValue="Open Tennis" />
        </label>

        <div className={styles.grid} style={{ marginTop: 'var(--space-4)' }}>
          <label className={styles.field}>
            <span className={styles.label}>Starts</span>
            <input className={styles.input} type="date" name="startDate" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Ends</span>
            <input className={styles.input} type="date" name="endDate" />
          </label>
        </div>
      </section>

      {state.error !== undefined && (
        <p className={styles.error} role="alert">{state.error}</p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create tournament'}
      </button>
    </form>
  );
}
