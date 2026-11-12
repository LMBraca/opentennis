import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteShell } from '@/components/site-shell';
import { PageBody, PageHeader } from '@/components/page-header';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteNav } from '@/components/site-nav';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import styles from './not-found.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: dict.notFoundTitle };
}

export default async function NotFound() {
  const locale = await currentLocale();
  const dict = dictionary(locale);

  return (
    <SiteShell>
      <main>
        <PageHeader
          title={dict.notFoundTitle}
          nav={<SiteNav dict={dict} />}
          actions={<LanguageToggle active={locale} />}
        />
        <PageBody width="measure">
          <p className={styles.body}>{dict.notFoundBody}</p>
          <nav className={styles.actions} aria-label={dict.notFoundTitle}>
            <Link href="/">{dict.notFoundHome}</Link>
            <Link href="/search">{dict.notFoundSearch}</Link>
          </nav>
        </PageBody>
      </main>
    </SiteShell>
  );
}
