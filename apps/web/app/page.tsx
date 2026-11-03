/**
 * Home.
 *
 * Lists the organization's tournaments and links into each.
 *
 * An earlier revision redirected straight into the only published tournament,
 * on the theory that a list of one is not a choice. That was wrong: it meant
 * the site had no home page at all, and landing somewhere you did not ask for
 * reads as a broken link rather than a shortcut. The list is always shown.
 */

import Link from 'next/link';
import { listTournaments, type TournamentSummary } from '@/lib/queries';
import { LiveDot } from '@/components/category-chip';
import styles from './home.module.css';

export const dynamic = 'force-dynamic';

/**
 * timeZone: 'UTC' throughout. These are plain calendar dates stored as text;
 * formatting them in the server's local zone shifts them a day west of
 * Greenwich.
 */
function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function dateRange(start: string | null, end: string | null): string | null {
  if (start === null) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(parseDate(start), parseDate(end ?? start));
}

function DateTile({ start }: { readonly start: string | null }) {
  if (start === null) {
    return (
      <div className={styles.dateTile}>
        <span className={styles.dateMonth}>TBD</span>
      </div>
    );
  }
  const date = parseDate(start);
  return (
    <div className={styles.dateTile}>
      <span className={styles.dateDay}>
        {new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' }).format(date)}
      </span>
      <span className={styles.dateMonth}>
        {new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date)}
      </span>
    </div>
  );
}

function Section({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly TournamentSummary[];
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <ul className={styles.list}>
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/t/${t.slug}`} className={styles.card}>
              <DateTile start={t.startDate} />
              <div className={styles.cardBody}>
                <span className={styles.cardMeta}>
                  {[t.venue, dateRange(t.startDate, t.endDate)].filter(Boolean).join(' · ')}
                </span>
                <span className={styles.cardName}>{t.name}</span>
                <span className={styles.cardStats}>
                  <span className={styles.stat}>
                    <span className={styles.statNumber}>{t.drawCount}</span>
                    <span className={styles.statLabel}>
                      {t.drawCount === 1 ? 'draw' : 'draws'}
                    </span>
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statNumber}>{t.entrantCount}</span>
                    <span className={styles.statLabel}>entrants</span>
                  </span>
                  {t.liveCount > 0 && <LiveDot />}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Home() {
  const tournaments = await listTournaments();

  const live = tournaments.filter((t) => t.status === 'inProgress' || t.liveCount > 0);
  const liveIds = new Set(live.map((t) => t.id));
  const past = tournaments.filter((t) => t.status === 'complete' && !liveIds.has(t.id));
  const pastIds = new Set(past.map((t) => t.id));
  const upcoming = tournaments.filter((t) => !liveIds.has(t.id) && !pastIds.has(t.id));

  const totalDraws = tournaments.reduce((n, t) => n + t.drawCount, 0);
  const totalEntrants = tournaments.reduce((n, t) => n + t.entrantCount, 0);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.club}>Riverside Tennis Club</p>
          <h1 className={styles.title}>Tournaments</h1>
          {tournaments.length > 0 && (
            <div className={styles.heroStats}>
              <span className={styles.heroStat}>
                <span className={styles.heroNumber}>{tournaments.length}</span>
                <span className={styles.heroLabel}>
                  {tournaments.length === 1 ? 'Tournament' : 'Tournaments'}
                </span>
              </span>
              <span className={styles.heroStat}>
                <span className={styles.heroNumber}>{totalDraws}</span>
                <span className={styles.heroLabel}>Draws</span>
              </span>
              <span className={styles.heroStat}>
                <span className={styles.heroNumber}>{totalEntrants}</span>
                <span className={styles.heroLabel}>Entrants</span>
              </span>
            </div>
          )}
        </div>
      </header>

      <div className={styles.content}>
        {tournaments.length === 0 ? (
          <p className={styles.empty}>No tournaments have been published yet.</p>
        ) : (
          <>
            <Section title="Running now" items={live} />
            <Section title="Upcoming" items={upcoming} />
            <Section title="Results" items={past} />
          </>
        )}
      </div>
    </main>
  );
}
