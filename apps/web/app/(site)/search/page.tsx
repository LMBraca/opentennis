/**
 * PUB-10 — find a player.
 *
 * A plain GET form, no JavaScript: the query lives in the URL, so a result
 * can be bookmarked or sent to somebody, and the page works on the worst
 * connection at the back of a clubhouse.
 *
 * Matching is accent-folded (`lib/player-name.ts`), which is the whole
 * point for this club — most members' surnames carry an accent and almost
 * nobody types one into a search box.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { searchEntrants } from '@/lib/player-queries';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { LanguageToggle } from '@/components/language-toggle';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from './search.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: dict.searchTitle };
}

export default async function SearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const hits = query === '' ? [] : await searchEntrants(query);

  return (
    <main className={styles.page}>
      <PageHeader
        title={dict.searchTitle}
        lead={dict.searchHint}
        actions={<LanguageToggle active={locale} />}
      />

      <PageBody>
        <form className={styles.form} method="get">
          <input
            className={styles.input}
            type="search"
            name="q"
            defaultValue={query}
            placeholder={dict.searchPlaceholder}
            aria-label={dict.searchTitle}
            autoComplete="off"
          />
          <button className={styles.button} type="submit">
            {dict.searchTitle}
          </button>
        </form>

        {query !== '' && hits.length === 0 && (
          <p className={styles.empty}>{dict.searchNoResults}</p>
        )}

        {hits.length > 0 && (
          <ul className={styles.results}>
            {hits.map((hit) => (
              <li key={hit.playerId} className={styles.hit}>
                <Link className={styles.hitName} href={`/p/${hit.playerId}`}>
                  {hit.name}
                </Link>
                <span className={styles.hitWhere}>
                  {hit.tournaments.map((t) => (
                    <span key={t} className={styles.hitTournament}>
                      {t}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}

      </PageBody>
    </main>
  );
}
