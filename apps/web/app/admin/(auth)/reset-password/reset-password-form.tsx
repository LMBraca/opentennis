'use client';

import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from '../invite/invite.module.css';

export function ResetPasswordForm({
  actionUrl,
  dict,
  error,
}: {
  readonly actionUrl: string;
  readonly dict: Dictionary;
  readonly error?: 'passwordMismatch' | 'passwordTooShort' | undefined;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form
      method="post"
      action={actionUrl}
      className={styles.actions}
      noValidate
      onSubmit={() => setPending(true)}
    >
      <label>
        {dict.newPassword}
        <input name="password" type="password" autoComplete="new-password" />
      </label>
      <p className={styles.hint}>{dict.passwordHint}</p>
      <label>
        {dict.confirmPassword}
        <input name="confirmPassword" type="password" autoComplete="new-password" />
      </label>
      {error !== undefined && (
        <p className={styles.error} role="alert">
          {dict[error]}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? dict.saving : dict.saveNewPassword}
      </button>
    </form>
  );
}
