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

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Consolation</h2>

        <label className={styles.check}>
          <input type="checkbox" name="consolationDraws" />
          <span>
            Run a consolation draw
            <span className={styles.hint}>
              Everyone who loses their first match goes into a second, smaller bracket, so
              nobody travels for one match. Applies to knockout draws when you generate
              them — round robins already give everyone several matches. Decide now: it
              cannot be added to a draw that has already been made.
            </span>
          </span>
        </label>
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
