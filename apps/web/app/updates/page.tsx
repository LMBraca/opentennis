/**
 * Club updates.
 *
 * The first post is given a wide card with its cover image; the rest are a
 * list. A uniform grid of equal cards makes every post look equally
 * important, which is never true of a news feed — the newest one is the
 * reason anyone opened the page.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { listUpdates, type UpdateSummary } from '@/lib/queries';
import { excerptFrom } from '@/lib/markdown';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import { SiteNav } from '@/components/site-nav';
import { Reveal } from '@/components/reveal';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, intlLocale, type Dictionary } from '@/lib/i18n/dictionaries';
import styles from './updates.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: `${dict.updates} · Open Tennis`, description: dict.updatesSub };
}

/** UTC, like every other date on the site: these are calendar dates. */
function formatDate(date: Date | null, locale: string): string {
  if (date === null) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function teaser(update: UpdateSummary): string {
  // A hand-written excerpt always wins; falling back to the first paragraph
  // means an author who skips the field still gets a readable card.
  return update.excerpt ?? excerptFrom(update.body);
}

function Lead({
  update,
  dict,
  locale,
}: {
  readonly update: UpdateSummary;
  readonly dict: Dictionary;
  readonly locale: string;
}) {
  return (
    <Link href={`/updates/${update.slug}`} className={styles.lead}>
      {update.coverUrl !== null && (
        /* eslint-disable-next-line @next/next/no-img-element --
           Covers are arbitrary remote URLs an admin pastes in. next/image
           would need every future host in next.config, and a broken image is
           a worse failure than an unoptimised one. */
        <img
          src={update.coverUrl}
          alt={update.coverAlt ?? ''}
          className={styles.leadImage}
          loading="eager"
        />
      )}
      <div className={styles.leadBody}>
        <span className={styles.meta}>
          {formatDate(update.publishedAt, locale)}
        </span>
        <h2 className={styles.leadTitle}>{update.title}</h2>
        {teaser(update) !== '' && <p className={styles.leadExcerpt}>{teaser(update)}</p>}
        <span className={styles.readMore}>{dict.readMore}</span>
      </div>
    </Link>
  );
}

function Row({
  update,
  dict,
  locale,
}: {
  readonly update: UpdateSummary;
  readonly dict: Dictionary;
  readonly locale: string;
}) {
  return (
    <Link href={`/updates/${update.slug}`} className={styles.row}>
      {update.coverUrl !== null ? (
        /* eslint-disable-next-line @next/next/no-img-element -- see Lead */
        <img src={update.coverUrl} alt="" className={styles.thumb} loading="lazy" />
      ) : (
        <span className={styles.thumbEmpty} aria-hidden="true" />
      )}
      <span className={styles.rowBody}>
        <span className={styles.meta}>{formatDate(update.publishedAt, locale)}</span>
        <span className={styles.rowTitle}>{update.title}</span>
        {teaser(update) !== '' && <span className={styles.rowExcerpt}>{teaser(update)}</span>}
        {update.mediaCount > 0 && (
          <span className={styles.badge}>
            {update.mediaCount} {update.mediaCount === 1 ? dict.photo : dict.photos}
          </span>
        )}
      </span>
    </Link>
  );
}

export default async function UpdatesPage() {
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const intl = intlLocale(locale);
  const updates = await listUpdates();

  const [lead, ...rest] = updates;

  return (
    <main className={styles.page}>
      <PageHeader
        title={dict.updates}
        lead={dict.updatesSub}
        nav={<SiteNav dict={dict} />}
        actions={<LanguageToggle active={locale} />}
      />

      <PageBody>
        {lead === undefined ? (
          <p className={styles.empty}>{dict.noUpdates}</p>
        ) : (
          <>
            <Reveal>
              <Lead update={lead} dict={dict} locale={intl} />
            </Reveal>
            {rest.length > 0 && (
              <ul className={styles.list}>
                {rest.map((u, i) => (
                  <li key={u.id}>
                    <Reveal delay={i * 60}>
                      <Row update={u} dict={dict} locale={intl} />
                    </Reveal>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <SiteFooter />
      </PageBody>
    </main>
  );
}
