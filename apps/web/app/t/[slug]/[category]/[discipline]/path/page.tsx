/**
 * PUB-5 — one entrant's path through a draw.
 *
 * A bracket read sideways: the matches one competitor actually played, in
 * order, with who they beat and who stopped them. On a phone this is the
 * useful view — the full bracket is a horizontal scroll and most people
 * only care about one line through it.
 *
 * The entrant is a query parameter rather than a path segment so the draw's
 * own URL keeps its shape; `/t/:slug/:cat/:disc/path` with no entrant is a
 * picker, not a 404.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { entrantName, listDrawEntrants, loadPath } from '@/lib/player-queries';
import { drawLabel, parseDrawSegment } from '@/lib/divisions';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { loadDraw } from '@/lib/queries';
import { MatchCard } from '@/components/match-card';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from './path.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Path' };

export default async function PathPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string; category: string; discipline: string }>;
  readonly searchParams: Promise<{ entrant?: string }>;
}) {
  const { slug, category, discipline } = await params;
  const { entrant } = await searchParams;
  const parsed = parseDrawSegment(discipline);
  if (parsed === null) notFound();

  const draw = await loadDraw(slug, category, parsed.discipline, parsed.division);
  if (draw === null) notFound();

  const locale = await currentLocale();
  const dict = dictionary(locale);
  const label = drawLabel(draw.category.code, parsed.division, parsed.discipline, dict);

  const entrants = await listDrawEntrants(slug, category, parsed.discipline, parsed.division);
  const chosen = entrant ?? '';
  const matches = chosen === '' ? [] : await loadPath(chosen);
  const who = chosen === '' ? null : await entrantName(chosen);

  return (
    <main className={styles.page}>
      <PageHeader
        back={{ href: `/t/${slug}/${category}/${discipline}`, label: dict.backToDraw }}
        title={who ?? dict.pathTitle}
        lead={label}
        actions={<LanguageToggle active={locale} />}
      />

      <PageBody>
        {/* A plain GET form: no JavaScript, and the chosen path is a URL
            somebody can send to the player it belongs to. */}
        <form className={styles.picker} method="get">
          <label className={styles.label} htmlFor="entrant">
            {dict.choosePlayer}
          </label>
          <select className={styles.select} id="entrant" name="entrant" defaultValue={chosen}>
            <option value="">—</option>
            {entrants.map((e) => (
              <option key={e.entrantId} value={e.entrantId}>
                {e.name}
              </option>
            ))}
          </select>
          <button className={styles.go} type="submit">
            {dict.viewPath}
          </button>
        </form>

        {chosen !== '' && matches.length === 0 && (
          <p className={styles.empty}>{dict.notPlayed}</p>
        )}

        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            dict={dict}
            locale={locale}
            highlightEntrantId={chosen}
          />
        ))}

        <p className={styles.more}>
          <Link className={styles.link} href="/search">
            {dict.searchTitle}
          </Link>
        </p>

        <SiteFooter />
      </PageBody>
    </main>
  );
}
