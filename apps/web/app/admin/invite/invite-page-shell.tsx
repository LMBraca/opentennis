import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/brand-header';
import { LanguageToggle } from '@/components/language-toggle';
import { PageBody, PageHeader } from '@/components/page-header';
import { SiteNav } from '@/components/site-nav';
import { dictionary, type Locale } from '@/lib/i18n/dictionaries';
import styles from './invite.module.css';

export function InvitePageShell({
  children,
  locale,
  title,
}: {
  readonly children: ReactNode;
  readonly locale: Locale;
  readonly title: string;
}) {
  const dict = dictionary(locale);
  return (
    <main className={styles.page}>
      <PageHeader
        title={title}
        nav={<SiteNav dict={dict} />}
        actions={<LanguageToggle active={locale} />}
      />
      <PageBody width="measure">
        <section className={styles.panel}>{children}</section>
        <div className={styles.recovery}>
          <SiteFooter />
        </div>
      </PageBody>
    </main>
  );
}
