import type { Metadata } from 'next';
import { getPasswordReset } from '@opentennis/db';
import { db } from '@/lib/db';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { InvitePageShell } from '../invite/invite-page-shell';
import styles from '../invite/invite.module.css';
import { InvalidPasswordResetPage } from './invalid-page';
import { ResetPasswordForm } from './reset-password-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string }>;
}): Promise<Metadata> {
  const { token } = await searchParams;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const reset = await getPasswordReset(db(), token);
  const title =
    reset === null
      ? `${dict.resetLinkInvalidTitle} · OpenTennis`
      : `${dict.resetPasswordTitle} · OpenTennis`;
  return { title: { absolute: title } };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const locale = await currentLocale();
  const { token, error } = await searchParams;
  const reset = await getPasswordReset(db(), token);
  if (reset === null || token === undefined) {
    return <InvalidPasswordResetPage locale={locale} />;
  }
  const dict = dictionary(locale);
  const knownErrors = ['passwordMismatch', 'passwordTooShort'] as const;
  const errorKey = knownErrors.find((key) => key === error);
  return (
    <InvitePageShell
      locale={locale}
      title={dict.resetPasswordTitle}
      backHref="/admin/login"
      backLabel={dict.backToSignIn}
    >
      <p className={styles.hint}>{dict.resetPasswordLead}</p>
      <p className={styles.lockedEmail}>
        <span className={styles.emailLabel}>{dict.email}: </span>
        <span className={styles.emailAddress}>{reset.email}</span>
      </p>
      <ResetPasswordForm
        actionUrl={`/admin/reset-password/submit?token=${encodeURIComponent(token)}`}
        dict={dict}
        error={errorKey}
      />
    </InvitePageShell>
  );
}
