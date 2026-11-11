import Link from 'next/link';
import { dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { InvitePageShell } from './invite-page-shell';
import styles from '../login/login.module.css';

export function InvalidInvitePage({ locale }: { readonly locale: Locale }) {
  const dict = dictionary(locale);
  return (
    <InvitePageShell locale={locale} title={dict.inviteLinkInvalid}>
      <p className={styles.hint}>{dict.inviteLinkInvalidBody}</p>
      <Link className={styles.link} href="/">
        {dict.notFoundHome}
      </Link>
    </InvitePageShell>
  );
}
