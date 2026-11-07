/**
 * One match, as a row.
 *
 * Shared by the match detail sheet (PUB-6), a player's history (PUB-9) and
 * their path through a draw (PUB-5), so the three pages cannot disagree
 * about how a score reads. They each show the same thing at a different
 * zoom; three renderings of "6-3 7-6(5) RET" would drift and one of them
 * would end up wrong about who won.
 *
 * Server component: it renders text, so there is no reason to ship it.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { MatchDetail } from '@/lib/player-queries';
import { outcomeAbbreviation } from '@/lib/match-result';
import { drawLabel, drawSegment, type Discipline, type Division } from '@/lib/divisions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { venueDateFormatter, venueTimeFormatter } from '@/lib/venue-time';
import styles from './match-card.module.css';
import { roundLabel } from '@/lib/draw-text';

/** "6-3 7-6(5)" from one side's point of view, winner's games first. */
export function scoreLine(match: MatchDetail, fromPosition: 0 | 1 = 0): string {
  return match.sets
    .map((set) => {
      const mine = fromPosition === 0 ? set.side0Games : set.side1Games;
      const theirs = fromPosition === 0 ? set.side1Games : set.side0Games;
      const tb = fromPosition === 0 ? set.side1TiebreakPoints : set.side0TiebreakPoints;
      const loserTb = Math.min(set.side0TiebreakPoints ?? -1, set.side1TiebreakPoints ?? -1);
      // Convention: the tiebreak score shown is the LOSER's points.
      const mark = tb === null || loserTb < 0 ? '' : `(${loserTb})`;
      return `${mine}-${theirs}${mark}`;
    })
    .join(' ');
}

export function MatchCard({
  match,
  dict,
  locale,
  highlightEntrantId,
  showTournament = false,
}: {
  readonly match: MatchDetail;
  readonly dict: Dictionary;
  readonly locale: string;
  /** Bolds one side — the player whose page this is. */
  readonly highlightEntrantId?: string | null;
  readonly showTournament?: boolean;
}): ReactNode {
  const segment = drawSegment(match.division as Division, match.discipline as Discipline);
  const label = drawLabel(
    match.categoryCode,
    match.division as Division,
    match.discipline as Discipline,
    dict,
  );
  const mark = outcomeAbbreviation(match.outcome);
  const played = match.status === 'complete';

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        {showTournament && (
          <Link
            className={styles.tournament}
            href={`/t/${match.tournamentSlug}/${match.categorySlug}/${segment}`}
          >
            {match.tournamentName}
          </Link>
        )}
        <span className={styles.draw}>{label}</span>
        {match.roundName !== '' && (
          <span className={styles.round}>{roundLabel(match.roundName, dict)}</span>
        )}
        {match.scheduledAt !== null && (
          <span className={styles.when}>
            {venueDateFormatter(locale).format(match.scheduledAt)}
            {' '}
            {venueTimeFormatter(locale).format(match.scheduledAt)}
          </span>
        )}
        {match.courtName !== null && <span className={styles.court}>{match.courtName}</span>}
      </div>

      <ol className={styles.sides}>
        {[0, 1].map((position) => {
          const side = match.sides.find((s) => s.position === position);
          const isMe =
            highlightEntrantId != null && side?.entrantId === highlightEntrantId;
          return (
            <li
              key={position}
              className={styles.side}
              data-winner={side?.isWinner ? 'true' : undefined}
              data-me={isMe ? 'true' : undefined}
            >
              <span className={styles.name}>
                {side?.isBye ? dict.bye : side?.name ?? <span className={styles.undecided}>—</span>}
                {side?.seed != null && <sup className={styles.seed}>{side.seed}</sup>}
              </span>
              <span className={styles.games}>
                {match.sets.map((set) => {
                  const games = position === 0 ? set.side0Games : set.side1Games;
                  const tb = position === 0 ? set.side0TiebreakPoints : set.side1TiebreakPoints;
                  return (
                    <span key={set.setIndex} className={styles.set}>
                      {games}
                      {tb !== null && <sup className={styles.tb}>{tb}</sup>}
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ol>

      {!played && match.status !== 'bye' && match.sets.length === 0 && (
        <p className={styles.pending}>{dict.notPlayed}</p>
      )}
      {mark !== null && <p className={styles.mark}>{mark}</p>}

      <Link
        className={styles.detail}
        href={`/t/${match.tournamentSlug}/${match.categorySlug}/${segment}/m/${match.id}`}
      >
        {dict.viewMatch}
      </Link>
    </article>
  );
}
