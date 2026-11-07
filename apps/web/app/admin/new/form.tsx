'use client';

import { useActionState } from 'react';
import { createTournament, type ActionState } from '../tournament-actions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from '../[slug]/schedule/schedule.module.css';

export function NewTournamentForm({ dict }: { readonly dict: Dictionary }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTournament, {});

  return (
    <form action={action} className={styles.form}>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>{dict.details}</h2>

        <label className={styles.field}>
          <span className={styles.label}>{dict.tournamentName}</span>
          <input
            className={styles.input}
            name="name"
            required
            autoFocus
            placeholder={dict.tournamentNameExample}
          />
        </label>

        <div className={styles.grid} style={{ marginTop: 'var(--space-4)' }}>
          <label className={styles.field}>
            <span className={styles.label}>{dict.starts}</span>
            <input className={styles.input} type="date" name="startDate" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{dict.ends}</span>
            <input className={styles.input} type="date" name="endDate" />
          </label>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>{dict.consolation}</h2>

        <label className={styles.check}>
          <input type="checkbox" name="consolationDraws" />
          <span>
            {dict.runConsolation}
            <span className={styles.hint}>{dict.runConsolationHint}</span>
          </span>
        </label>
      </section>

      {state.error !== undefined && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? dict.creating : dict.createTournament}
      </button>
    </form>
  );
}
