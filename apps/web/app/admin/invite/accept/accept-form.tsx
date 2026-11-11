'use client';

import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from '../../login/login.module.css';

export function AcceptInviteForm({
  actionUrl,
  dict,
  error,
}: {
  readonly actionUrl: string;
  readonly dict: Dictionary;
  readonly error?: 'entryNeedName' | 'passwordTooShort' | 'passwordMismatch' | undefined;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form
      method="post"
      action={actionUrl}
      className={styles.form}
      noValidate
      onSubmit={() => setPending(true)}
    >
      <label className={styles.field}>
        <span className={styles.label}>{dict.yourName}</span>
        <input className={styles.input} name="name" autoComplete="name" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{dict.password}</span>
        <input
          className={styles.input}
          name="password"
          type="password"
          autoComplete="new-password"
        />
      </label>
      <p className={styles.hint}>{dict.passwordHint}</p>
      <label className={styles.field}>
        <span className={styles.label}>{dict.confirmPassword}</span>
        <input
          className={styles.input}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
        />
      </label>
      {error !== undefined && (
        <p className={styles.error} role="alert">
          {dict[error]}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? dict.signingIn : dict.acceptInvite}
      </button>
    </form>
  );
}
