'use client';

import { useActionState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { fill } from '@/lib/i18n/dictionaries';
import { cancelInvite, inviteAdmin, type InviteActionState } from './actions';
import styles from './team.module.css';

function Denial({
  dict,
  role,
}: {
  readonly dict: Dictionary;
  readonly role: InviteActionState['role'];
}) {
  return (
    <p className={styles.error} role="alert">
      {fill(dict.permissionDenied, {
        role: role ?? 'viewer',
        action: dict.denialInviteAdmins,
      })}{' '}
      {dict.askOwner}
    </p>
  );
}

export function InviteForm({ dict }: { readonly dict: Dictionary }) {
  const [state, action, pending] = useActionState<InviteActionState, FormData>(inviteAdmin, {});
  return (
    <form action={action} className={styles.form} noValidate>
      <label className={styles.field}>
        <span>{dict.email}</span>
        <input className={styles.input} name="email" type="email" autoComplete="email" />
      </label>
      {state.error !== undefined &&
        (state.error === 'denied' ? (
          <Denial dict={dict} role={state.role} />
        ) : (
          <p className={styles.error} role="alert">
            {dict[state.error]}
          </p>
        ))}
      {state.email !== undefined && (
        <p className={styles.success} role="status">
          {fill(dict.inviteSent, { email: state.email })}
        </p>
      )}
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? dict.sending : dict.inviteAdmin}
      </button>
    </form>
  );
}

function PendingInviteActions({
  invitationId,
  email,
  dict,
}: {
  readonly invitationId: string;
  readonly email: string;
  readonly dict: Dictionary;
}) {
  const [resendState, resendAction, resending] = useActionState<InviteActionState, FormData>(
    inviteAdmin,
    {},
  );
  const [cancelState, cancelAction, cancelling] = useActionState<InviteActionState, FormData>(
    cancelInvite,
    {},
  );
  return (
    <div className={styles.rowActions}>
      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <button className={styles.action} type="submit" disabled={resending}>
          {resending ? dict.sending : dict.resendInvite}
        </button>
      </form>
      <form action={cancelAction}>
        <input type="hidden" name="invitationId" value={invitationId} />
        <button className={styles.actionGhost} type="submit" disabled={cancelling}>
          {dict.cancel}
        </button>
      </form>
      {resendState.error !== undefined &&
        (resendState.error === 'denied' ? (
          <Denial dict={dict} role={resendState.role} />
        ) : (
          <p className={styles.error} role="alert">
            {dict[resendState.error]}
          </p>
        ))}
      {resendState.email !== undefined && (
        <p className={styles.success} role="status">
          {fill(dict.inviteSent, { email: resendState.email })}
        </p>
      )}
      {cancelState.error === 'denied' && <Denial dict={dict} role={cancelState.role} />}
      {cancelState.cancelled && (
        <p className={styles.success} role="status">
          {dict.inviteCancelled}
        </p>
      )}
    </div>
  );
}

export function PendingInviteRows({
  invitations,
  dict,
}: {
  readonly invitations: readonly {
    readonly id: string;
    readonly email: string;
    readonly expires: string;
  }[];
  readonly dict: Dictionary;
}) {
  return (
    <ul className={styles.list}>
      {invitations.map((invite) => (
        <li key={invite.id} className={styles.row}>
          <div className={styles.rowMain}>
            <span className={styles.email}>{invite.email}</span>
            <span className={styles.muted}>
              {fill(dict.inviteExpires, { date: invite.expires })}
            </span>
          </div>
          <PendingInviteActions invitationId={invite.id} email={invite.email} dict={dict} />
        </li>
      ))}
    </ul>
  );
}
