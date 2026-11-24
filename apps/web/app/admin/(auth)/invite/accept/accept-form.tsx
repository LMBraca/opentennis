'use client';

import * as React from 'react';
import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from '../invite.module.css';

export function AcceptInviteForm({
  actionUrl,
  dict,
  error,
  name,
}: {
  readonly actionUrl: string;
  readonly dict: Dictionary;
  readonly error?:
    'entryNeedName' | 'passwordTooShort' | 'passwordMismatch' | 'invalid' | undefined;
  readonly name: string;
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
        {dict.yourName}
        <input name="name" autoComplete="name" defaultValue={name} />
      </label>
      <label>
        {dict.password}
        <input name="password" type="password" autoComplete="new-password" />
      </label>
      <p className={styles.hint}>{dict.passwordHint}</p>
      <label>
        {dict.confirmPassword}
        <input name="confirmPassword" type="password" autoComplete="new-password" />
      </label>
      {error !== undefined && (
        <p className={styles.error} role="alert">
          {error === 'invalid' ? dict.acceptInviteFailed : dict[error]}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? dict.signingIn : dict.acceptInvite}
      </button>
    </form>
  );
}
