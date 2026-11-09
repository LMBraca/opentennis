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
  const dict = dictionary(await currentLocale());
  return { title: profile?.name ?? dict.notFoundTitle };
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

  /*
   * OT-14. The header counts completed matches; the list showed every
   * match. So a player with one result and one scheduled match read
   * "1 Partido" above two cards, and the number looked wrong rather than
   * differently scoped. Splitting the list makes the scope visible, which
   * is cheaper than explaining it.
   */
  const upcoming = profile.matches.filter((m) => m.status !== 'complete');

  /*
   * OT-15. Which draws this player actually has a path through.
   *
   * An entry exists from the moment they are accepted, but the path page
   * has nothing to draw until they are in a match, so linking every entry
   * would hand out dead controls on a draw that is not generated yet.
   */
  const drawKey = (e: {
    tournamentSlug: string;
    categorySlug: string;
    discipline: string;
    division: string;
  }) => `${e.tournamentSlug}/${e.categorySlug}/${e.discipline}/${e.division}`;
  const drawsWithPath = new Set(profile.matches.map(drawKey));

  return (
    <main className={styles.page}>
      <PageHeader
        title={profile.name}
        facts={[
          // OT-14: "partidos jugados", not "partidos" — the count excludes
          // anything still to be played, and the unlabelled version read as
          // a miscount next to an unplayed card.
          { value: played.length, label: dict.completedMatches },
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
                  {/*
                    OT-15. This entrant's run through that draw. Omitted
                    rather than disabled when the draw has no matches yet —
                    a dead control is a worse answer than no control.
                  */}
                  {drawsWithPath.has(drawKey(entry)) && (
                    <Link
                      className={styles.entryPath}
                      /* RV-4 deleted /path and this link went on pointing
                         at it, so it 404'd. The draw is the useful
                         destination anyway: it is where this player's
                         matches are. */
                      href={`/t/${entry.tournamentSlug}/${entry.categorySlug}/${drawSegment(
                        entry.division as Division,
                        entry.discipline as Discipline,
                      )}`}
                    >
                      {dict.draw}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* OT-14: upcoming first — it is the question a player opens their
            own profile to answer. Only rendered when there is something in
            it, so a finished tournament does not grow an empty heading. */}
        {upcoming.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.blockTitle}>{dict.upcoming}</h2>
            {upcoming.map((match) => (
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
            ))}
          </section>
        )}

        <section className={styles.block}>
          <h2 className={styles.blockTitle}>{dict.playerHistory}</h2>
          {played.length === 0 ? (
            <p className={styles.empty}>{dict.notPlayed}</p>
          ) : (
            played.map((match) => (
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
