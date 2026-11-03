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

function formatDates(start: string | null, end: string | null): string | null {
  if (start === null) return null;
  // timeZone: 'UTC' is load-bearing. These are plain calendar dates stored as
  // text; formatting them in the server's local zone shifts them a day west of
  // Greenwich.
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(new Date(`${start}T00:00:00Z`), new Date(`${end ?? start}T00:00:00Z`));
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
              <span className={styles.cardMeta}>
                {[t.venue, formatDates(t.startDate, t.endDate)].filter(Boolean).join(' · ')}
              </span>
              <span className={styles.cardName}>{t.name}</span>
              <span className={styles.cardStats}>
                <span>
                  {t.drawCount} {t.drawCount === 1 ? 'draw' : 'draws'}
                </span>
                <span>{t.entrantCount} entrants</span>
                {t.liveCount > 0 && <LiveDot />}
              </span>
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

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className="ot-label">Riverside Tennis Club</p>
        <h1 className={styles.title}>Tournaments</h1>
      </header>

      {tournaments.length === 0 ? (
        <p className={styles.empty}>No tournaments have been published yet.</p>
      ) : (
        <>
          <Section title="Running now" items={live} />
          <Section title="Upcoming" items={upcoming} />
          <Section title="Results" items={past} />
        </>
      )}
    </main>
  );
}
