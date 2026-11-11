import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/brand-header';
import { LanguageToggle } from '@/components/language-toggle';
import type { Locale } from '@/lib/i18n/dictionaries';
import styles from '../login/login.module.css';

export function InvitePageShell({
  children,
  locale,
  title,
}: {
  readonly children: ReactNode;
  readonly locale: Locale;
  readonly title: string;
}) {
  return (
    <>
      <main className={styles.page}>
        <div className={styles.locale}>
          <LanguageToggle active={locale} />
        </div>
        <section className={styles.panel}>
          <p className={styles.club}>Open Tennis</p>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
