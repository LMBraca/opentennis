'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import { requestPasswordReset, type PasswordResetRequestState } from './actions';
import styles from '../invite/invite.module.css';

export function ForgotPasswordForm({ dict }: { readonly dict: Dictionary }) {
  const [state, action, pending] = useActionState<PasswordResetRequestState, FormData>(
    requestPasswordReset,
    {},
  );
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.sent) statusRef.current?.focus();
  }, [state.sent]);

  if (state.sent) {
    return (
      <div ref={statusRef} role="status" tabIndex={-1}>
        <p>{fill(dict.resetLinkSent, { email: state.email ?? '' })}</p>
        <Link className={styles.homeLink} href="/admin/login">
          {dict.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className={styles.actions} noValidate>
      <label>
        {dict.email}
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          defaultValue={state.email}
        />
      </label>
      {state.error !== undefined && (
        <p className={styles.error} role="alert">
          {dict[state.error]}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? dict.sending : dict.sendResetLink}
      </button>
    </form>
  );
}
