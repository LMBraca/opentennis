/**
 * PUB-6 — the match detail sheet.
 *
 * A bracket node has room for two surnames and a score. This has room for
 * the rest: who was seeded, when and where it was played, how each set went,
 * and a way into either player's history. It is a ROUTE rather than a
 * dialog so it can be linked — the thing a player sends to the person they
 * just beat.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadMatch } from '@/lib/player-queries';
import { drawLabel, drawSegment, parseDrawSegment, type Discipline, type Division } from '@/lib/divisions';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { roundLabel } from '@/lib/draw-text';
import { MatchCard } from '@/components/match-card';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from './match.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{
    slug: string;
    category: string;
    discipline: string;
    matchId: string;
  }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { matchId } = await params;
  const match = await loadMatch(matchId);
  if (match === null) return { title: 'Match' };
  const names = match.sides.map((s) => s.name ?? '—').join(' v ');
  return { title: `${names} · ${match.tournamentName}` };
}

export default async function MatchPage({ params }: Params) {
  const { slug, category, discipline, matchId } = await params;
  const parsed = parseDrawSegment(discipline);
  if (parsed === null) notFound();

  const match = await loadMatch(matchId);
  if (match === null) notFound();

  const locale = await currentLocale();
  const dict = dictionary(locale);
  const segment = drawSegment(match.division as Division, match.discipline as Discipline);
  const label = drawLabel(
    match.categoryCode,
    match.division as Division,
    match.discipline as Discipline,
    dict,
  );

  return (
    <main className={styles.page}>
      <PageHeader
        back={{ href: `/t/${slug}/${category}/${segment}`, label: dict.backToDraw }}
        title={label}
        lead={match.roundName === '' ? undefined : roundLabel(match.roundName, dict)}
        actions={<LanguageToggle active={locale} />}
      />

      <PageBody>
        <MatchCard match={match} dict={dict} locale={locale} />

        {/* Straight into each player's history — the most likely next
            question after "what was the score" is "who are they". */}
        <nav className={styles.players}>
          {match.sides
            .filter((s) => s.name !== null)
            .map((s) => (
              <Link
                key={s.position}
                className={styles.playerLink}
                href={`/t/${slug}/${category}/${segment}/path?entrant=${s.entrantId ?? ''}`}
              >
                {s.name} — {dict.viewPath}
              </Link>
            ))}
        </nav>

        <SiteFooter />
      </PageBody>
    </main>
  );
}
