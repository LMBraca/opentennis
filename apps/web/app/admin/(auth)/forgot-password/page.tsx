import type { Metadata } from 'next';
import { InvitePageShell } from '../invite/invite-page-shell';
import styles from '../invite/invite.module.css';
import { ForgotPasswordForm } from './forgot-password-form';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: { absolute: `${dict.forgotPasswordTitle} · OpenTennis` } };
}

export default async function ForgotPasswordPage() {
  const locale = await currentLocale();
  const dict = dictionary(locale);
  return (
    <InvitePageShell
      locale={locale}
      title={dict.forgotPasswordTitle}
      backHref="/admin/login"
      backLabel={dict.backToSignIn}
    >
      <p className={styles.hint}>{dict.forgotPasswordLead}</p>
      <ForgotPasswordForm dict={dict} />
    </InvitePageShell>
  );
}
