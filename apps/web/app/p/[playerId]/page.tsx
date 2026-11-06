/**
 * PUB-9 — a player across every tournament.
 *
 * Only coherent because of ADM-14: before the merge existed, the same
 * person entered twice was two player rows and this page could show at most
 * half of someone's history, with no sign the other half existed.
 *
 * Public, so it shows published tournaments only. It deliberately carries
 * no contact details — a member's phone number is admin data, and this page
 * is reachable by anyone with the link.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPlayerProfile } from '@/lib/player-queries';
import { drawLabel, drawSegment, type Discipline, type Division } from '@/lib/divisions';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { MatchCard } from '@/components/match-card';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from './player.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ playerId: string }>;
}): Promise<Metadata> {
  const { playerId } = await params;
  const profile = await loadPlayerProfile(playerId);
  return { title: profile?.name ?? 'Player' };
}

export default async function PlayerPage({
  params,
}: {
  readonly params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const profile = await loadPlayerProfile(playerId);
  if (profile === null) notFound();

  const locale = await currentLocale();
  const dict = dictionary(locale);

  const mine = new Set(profile.entrantIds);
  const played = profile.matches.filter((m) => m.status === 'complete');
  // Won = the winning side is one of THIS player's entrants. Asking only
  // "was there a winner" would count every completed match as a win.
  const won = played.filter((m) =>
    m.sides.some((s) => s.isWinner && s.entrantId !== null && mine.has(s.entrantId)),
  ).length;

  return (
    <main className={styles.page}>
      <PageHeader
        title={profile.name}
        facts={[
          { value: played.length, label: played.length === 1 ? dict.match : dict.matches },
          { value: `${won}-${played.length - won}`, label: dict.wonLost },
        ]}
        actions={<LanguageToggle active={locale} />}
      />

      <PageBody>
        {profile.entries.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>{dict.playerEntries}</h2>
            <ul className={styles.entries}>
              {profile.entries.map((entry) => (
                <li
                  key={`${entry.tournamentSlug}-${entry.categorySlug}-${entry.discipline}-${entry.division}`}
                  className={styles.entry}
                >
                  <Link
                    className={styles.entryLink}
                    href={`/t/${entry.tournamentSlug}/${entry.categorySlug}/${drawSegment(
                      entry.division as Division,
                      entry.discipline as Discipline,
                    )}`}
                  >
                    {entry.tournamentName}
                  </Link>
                  <span className={styles.entryDraw}>
                    {drawLabel(
                      entry.categoryCode,
                      entry.division as Division,
                      entry.discipline as Discipline,
                      dict,
                    )}
                  </span>
                  {entry.seed !== null && (
                    <span className={styles.entrySeed}>
                      {dict.seedLabel} {entry.seed}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.block}>
          <h2 className={styles.blockTitle}>{dict.playerHistory}</h2>
          {profile.matches.length === 0 ? (
            <p className={styles.empty}>{dict.notPlayed}</p>
          ) : (
            profile.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                dict={dict}
                locale={locale}
                highlightEntrantId={
                  match.sides.find((s) => s.entrantId !== null && mine.has(s.entrantId))
                    ?.entrantId ?? null
                }
                showTournament
              />
            ))
          )}
        </section>

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
