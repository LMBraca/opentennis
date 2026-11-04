/**
 * Media.
 *
 * Every photo the club has published, grouped by the update it came from.
 * This is not a second content store — it is the same media rows the updates
 * page reads, along a different axis, so a caption fixed in one place is
 * fixed in both.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { listMedia, type MediaItem } from '@/lib/queries';
import { LanguageToggle } from '@/components/language-toggle';
import { BrandHeader, SponsorFooter } from '@/components/brand-header';
import { SiteNav } from '@/components/site-nav';
import { Gallery } from '@/components/gallery';
import { Reveal } from '@/components/reveal';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, intlLocale } from '@/lib/i18n/dictionaries';
import styles from './media.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: `${dict.media} · Open Tennis`, description: dict.mediaSub };
}

interface Album {
  readonly slug: string;
  readonly title: string;
  readonly publishedAt: Date | null;
  readonly items: MediaItem[];
}

/**
 * Group into albums, preserving query order.
 *
 * The query already sorts newest-update-first then by position, so insertion
 * order into the Map is the display order — no second sort, and no risk of
 * the two disagreeing.
 */
function toAlbums(items: readonly MediaItem[]): Album[] {
  const byUpdate = new Map<string, Album>();
  for (const item of items) {
    const existing = byUpdate.get(item.updateSlug);
    if (existing === undefined) {
      byUpdate.set(item.updateSlug, {
        slug: item.updateSlug,
        title: item.updateTitle,
        publishedAt: item.publishedAt,
        items: [item],
      });
    } else {
      existing.items.push(item);
    }
  }
  return [...byUpdate.values()];
}

export default async function MediaPage() {
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const intl = intlLocale(locale);
  const albums = toAlbums(await listMedia());

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <BrandHeader variant="onBrand">
            <LanguageToggle active={locale} />
          </BrandHeader>
          <h1 className={styles.title}>{dict.media}</h1>
          <p className={styles.sub}>{dict.mediaSub}</p>
          <SiteNav dict={dict} />
        </div>
      </header>

      <div className={styles.content}>
        {albums.length === 0 ? (
          <p className={styles.empty}>{dict.noMedia}</p>
        ) : (
          albums.map((album, i) => (
            <Reveal key={album.slug} delay={i * 60}>
              <section className={styles.album}>
                <div className={styles.albumHead}>
                  <Link href={`/updates/${album.slug}`} className={styles.albumTitle}>
                    {album.title}
                  </Link>
                  <span className={styles.albumMeta}>
                    {[
                      album.publishedAt === null
                        ? null
                        : new Intl.DateTimeFormat(intl, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'UTC',
                          }).format(album.publishedAt),
                      `${album.items.length} ${album.items.length === 1 ? dict.photo : dict.photos}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <Gallery items={album.items} />
              </section>
            </Reveal>
          ))
        )}
        <SponsorFooter />
      </div>
    </main>
  );
}
