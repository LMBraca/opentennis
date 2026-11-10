'use client';

import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from '../invite.module.css';

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
      className={styles.actions}
      onSubmit={() => setPending(true)}
    >
      <label>
        {dict.yourName}
        <input name="name" autoComplete="name" required />
      </label>
      <label>
        {dict.password}
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </label>
      <p className={styles.hint}>{dict.passwordHint}</p>
      <label>
        {dict.confirmPassword}
        <input name="confirmPassword" type="password" autoComplete="new-password" required />
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
