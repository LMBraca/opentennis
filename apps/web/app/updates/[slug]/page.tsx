/**
 * One update.
 *
 * Body width is capped at 38rem — roughly 70 characters — because an article
 * set the full width of a desktop window is genuinely harder to read, not
 * merely less fashionable.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { updateBySlug } from '@/lib/queries';
import { excerptFrom, renderMarkdown } from '@/lib/markdown';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import { Gallery } from '@/components/gallery';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, intlLocale } from '@/lib/i18n/dictionaries';
import styles from '../updates.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const update = await updateBySlug(slug);
  if (update === null) return { title: 'Open Tennis' };

  const description = update.excerpt ?? excerptFrom(update.body);
  return {
    title: `${update.title} · Open Tennis`,
    description,
    openGraph: {
      title: update.title,
      description,
      type: 'article',
      ...(update.coverUrl !== null ? { images: [update.coverUrl] } : {}),
    },
  };
}

export default async function UpdatePage({ params }: Params) {
  const { slug } = await params;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const intl = intlLocale(locale);

  const update = await updateBySlug(slug);
  // A draft or unpublished post 404s rather than 403s: that it exists at all
  // is not public information.
  if (update === null) notFound();

  const published =
    update.publishedAt === null
      ? null
      : new Intl.DateTimeFormat(intl, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(update.publishedAt);

  return (
    <main className={styles.page}>
      <PageHeader
        back={{ href: '/updates', label: dict.backToUpdates }}
        title={update.title}
        {...(published !== null ? { lead: published } : {})}
        actions={<LanguageToggle active={locale} />}
      />

      <PageBody>
        <article className={styles.article}>
          {update.coverUrl !== null && (
            /* eslint-disable-next-line @next/next/no-img-element --
               Remote URLs pasted by an admin; next/image would need every
               future host whitelisted in next.config. */
            <img
              src={update.coverUrl}
              alt={update.coverAlt ?? ''}
              className={styles.cover}
            />
          )}

          {/*
            Safe because lib/markdown.ts escapes every character of input
            before emitting any tag, and only ever emits tags it constructs
            itself. There is no path from the admin textarea to raw markup —
            see the injection suite in lib/markdown.test.ts.
          */}
          <div
            className={styles.prose}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(update.body) }}
          />

          {update.media.length > 0 && (
            <section className={styles.gallerySection}>
              <h2 className={styles.sectionTitle}>{dict.photos}</h2>
              <Gallery items={update.media} />
            </section>
          )}

          {update.tournamentSlug !== null && (
            <aside className={styles.related}>
              <span className={styles.meta}>{dict.relatedTournament}</span>
              <Link href={`/t/${update.tournamentSlug}`} className={styles.relatedLink}>
                {update.tournamentName}
              </Link>
            </aside>
          )}
        </article>
        <SiteFooter />
      </PageBody>
    </main>
  );
}
