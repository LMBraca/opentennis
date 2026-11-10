import Link from 'next/link';
import { PageBody, PageHeader } from '@/components/page-header';
import { SiteFooter } from '@/components/brand-header';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteNav } from '@/components/site-nav';
import { dictionary, type Locale } from '@/lib/i18n/dictionaries';
import styles from './invite.module.css';

export function InvalidInvitePage({ locale }: { readonly locale: Locale }) {
  const dict = dictionary(locale);
  return (
    <main className={styles.page}>
      <PageHeader
        title={dict.inviteLinkInvalid}
        nav={<SiteNav dict={dict} />}
        actions={<LanguageToggle active={locale} />}
      />
      <PageBody width="measure">
        <p className={styles.lead}>{dict.inviteLinkInvalidBody}</p>
        <Link href="/">{dict.notFoundHome}</Link>
        <div className={styles.recovery}>
          <SiteFooter />
        </div>
      </PageBody>
    </main>
  );
}
