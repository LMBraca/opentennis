'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '../actions';
import styles from './login.module.css';

export function LoginForm({ next }: { readonly next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />

      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="username"
          required
          autoFocus
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>

      {/* role=alert so a screen reader announces the failure without the
          user having to go looking for it. */}
      {state.error !== undefined && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
