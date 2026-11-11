import type { Metadata } from 'next';
import { invitationEmailForToken } from '@opentennis/db';
import { db } from '@/lib/db';
import { dictionary } from '@/lib/i18n/dictionaries';
import { currentLocale } from '@/lib/i18n/server';
import { InvalidInvitePage } from '../invalid-page';
import { AcceptInviteForm } from './accept-form';
import { InvitePageShell } from '../invite-page-shell';
import styles from '../../login/login.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string; error?: string }>;
}): Promise<Metadata> {
  const { token, error } = await searchParams;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const email = error === 'invalid' ? null : await invitationEmailForToken(db(), token);
  const title =
    email === null
      ? `${dict.inviteLinkInvalid} · OpenTennis`
      : `${dict.acceptInviteTitle} · OpenTennis`;
  return { title: { absolute: title } };
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const locale = await currentLocale();
  const { token, error } = await searchParams;
  const email = await invitationEmailForToken(db(), token);
  if (email === null || token === undefined) return <InvalidInvitePage locale={locale} />;
  const dict = dictionary(locale);
  const knownErrors = ['entryNeedName', 'passwordTooShort', 'passwordMismatch'] as const;
  const errorKey = knownErrors.find((key) => key === error);

  return (
    <InvitePageShell locale={locale} title={dict.acceptInviteTitle}>
      <p className={styles.hint}>{dict.acceptInviteLead}</p>
      <p className={styles.lockedEmail}>
        <strong>{dict.email}:</strong> {email}
        <br />
        {dict.inviteEmailLocked}
      </p>
      <AcceptInviteForm
        actionUrl={`/admin/invite/accept-submit?token=${encodeURIComponent(token)}`}
        dict={dict}
        error={errorKey}
      />
    </InvitePageShell>
  );
}
