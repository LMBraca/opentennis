import Link from 'next/link';
import type { Locale } from '@/lib/i18n/dictionaries';
import { dictionary } from '@/lib/i18n/dictionaries';
import { InvitePageShell } from '../invite/invite-page-shell';
import styles from '../invite/invite.module.css';

export function InvalidPasswordResetPage({ locale }: { readonly locale: Locale }) {
  const dict = dictionary(locale);
  return (
    <InvitePageShell locale={locale} title={dict.resetLinkInvalidTitle}>
      <p className={styles.hint}>{dict.resetLinkInvalidBody}</p>
      <p>
        <Link className={styles.homeLink} href="/admin/forgot-password">
          {dict.requestNewLink}
        </Link>
        <br />
        <Link className={styles.homeLink} href="/">
          {dict.notFoundHome}
        </Link>
      </p>
    </InvitePageShell>
  );
}
