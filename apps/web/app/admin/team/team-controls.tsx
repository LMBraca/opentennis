'use client';

import * as React from 'react';
import { useActionState, useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { fill } from '@/lib/i18n/dictionaries';
import { cancelInvite, inviteAdmin, type InviteActionState } from './actions';
import styles from './team.module.css';

type InviteRow = {
  readonly id: string;
  readonly email: string;
  readonly expires: string;
};

type FormAction = (formData: FormData) => void | Promise<void>;

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

export function InviteForm({
  dict,
  state,
  action,
  pending,
  onSubmit,
}: {
  readonly dict: Dictionary;
  readonly state: InviteActionState;
  readonly action: FormAction;
  readonly pending: boolean;
  readonly onSubmit: () => void;
}) {
  return (
    <form action={action} className={styles.form} noValidate onSubmit={onSubmit}>
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
  cancelAction,
  cancelling,
  onCancelSubmit,
}: {
  readonly invitationId: string;
  readonly email: string;
  readonly dict: Dictionary;
  readonly cancelAction: FormAction;
  readonly cancelling: boolean;
  readonly onCancelSubmit: () => void;
}) {
  const [resendState, resendAction, resending] = useActionState<InviteActionState, FormData>(
    inviteAdmin,
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
      <form action={cancelAction} onSubmit={onCancelSubmit}>
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
    </div>
  );
}

export function InviteStatus({
  dict,
  email,
  cancelled,
}: {
  readonly dict: Dictionary;
  readonly email?: string | undefined;
  readonly cancelled: boolean;
}) {
  const message = cancelled
    ? dict.inviteCancelled
    : email === undefined
      ? undefined
      : fill(dict.inviteSent, { email });
  if (message === undefined) return null;
  return (
    <p className={styles.success} role="status">
      {message}
    </p>
  );
}

export function TeamInviteManagement({
  invitations,
  dict,
}: {
  readonly invitations: readonly InviteRow[];
  readonly dict: Dictionary;
}) {
  const [inviteState, inviteAction, inviting] = useActionState<InviteActionState, FormData>(
    inviteAdmin,
    {},
  );
  const [cancelState, cancelAction, cancelling] = useActionState<InviteActionState, FormData>(
    cancelInvite,
    {},
  );
  const [lastAction, setLastAction] = useState<'invite' | 'cancel' | null>(null);
  const showInviteSent =
    lastAction === 'invite' && !inviting ? inviteState.email : undefined;
  const showCancelled =
    lastAction === 'cancel' && !cancelling && cancelState.cancelled === true;

  return (
    <>
      <section className={styles.section} aria-labelledby="team-invite-heading">
        <h2 className={styles.heading} id="team-invite-heading">
          {dict.inviteAdmin}
        </h2>
        <InviteForm
          dict={dict}
          state={inviteState}
          action={inviteAction}
          pending={inviting}
          onSubmit={() => setLastAction('invite')}
        />
        <InviteStatus dict={dict} email={showInviteSent} cancelled={showCancelled} />
        {cancelState.error === 'denied' && <Denial dict={dict} role={cancelState.role} />}
      </section>
      {invitations.length > 0 && (
        <section className={styles.section} aria-labelledby="team-pending-heading">
          <h2 className={styles.heading} id="team-pending-heading">
            {dict.pendingInvites}
          </h2>
          <ul className={styles.list}>
            {invitations.map((invite) => (
              <li key={invite.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.email}>{invite.email}</span>
                  <span className={styles.muted}>
                    {fill(dict.inviteExpires, { date: invite.expires })}
                  </span>
                </div>
                <PendingInviteActions
                  invitationId={invite.id}
                  email={invite.email}
                  dict={dict}
                  cancelAction={cancelAction}
                  cancelling={cancelling}
                  onCancelSubmit={() => setLastAction('cancel')}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
