/**
 * Tournament landing page (PUB-1, first cut).
 *
 * The category grid is the primary navigation: a spectator's first question is
 * "where's the C+ draw?" and the answer should be one tap, visible without
 * scrolling. Categories render in ladder order by `rank`, never alphabetically.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { and, asc, count, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { CategoryGrid, type CellStatus, type Discipline, type GridCell } from '@/components/category-grid';
import Link from 'next/link';
import { LanguageToggle } from '@/components/language-toggle';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, intlLocale } from '@/lib/i18n/dictionaries';
import styles from './tournament.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

async function loadTournament(slug: string) {
  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      venue: schema.tournaments.venue,
      startDate: schema.tournaments.startDate,
      endDate: schema.tournaments.endDate,
      visibility: schema.tournaments.visibility,
    })
    .from(schema.tournaments)
    .where(
      and(
        eq(schema.tournaments.organizationId, orgId()),
        eq(schema.tournaments.slug, slug),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await loadTournament(slug);
  return { title: tournament?.name ?? 'Tournament' };
}

const FORMAT_MAP = {
  roundRobin: 'roundRobin',
  singleElimination: 'singleElimination',
  hybrid: 'hybrid',
} as const;

export default async function TournamentPage({ params }: Params) {
  const { slug } = await params;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const organizationId = orgId();
  const tournament = await loadTournament(slug);

  // A draft tournament is not public. 404 rather than 403: the existence of an
  // unpublished draw is itself not public information.
  if (tournament === undefined || tournament.visibility === 'draft') notFound();

  const categories = await db()
    .select({
      id: schema.categories.id,
      code: schema.categories.code,
      slug: schema.categories.slug,
      rank: schema.categories.rank,
    })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, organizationId))
    .orderBy(asc(schema.categories.rank));

  // One row per enabled grid cell. Counts come from LEFT JOIN + GROUP BY
  // rather than correlated subqueries: a cell with no entrants must still
  // appear, and an INNER JOIN would silently drop it.
  const rows = await db()
    .select({
      eventId: schema.events.id,
      categoryId: schema.events.categoryId,
      discipline: schema.events.discipline,
      division: schema.events.division,
      format: schema.events.format,
      status: schema.events.status,
      entrantCount: count(schema.entrants.id),
    })
    .from(schema.events)
    .leftJoin(
      schema.entrants,
      and(
        eq(schema.entrants.eventId, schema.events.id),
        eq(schema.entrants.status, 'active'),
      ),
    )
    .where(
      and(
        eq(schema.events.organizationId, organizationId),
        eq(schema.events.tournamentId, tournament.id),
      ),
    )
    .groupBy(
      schema.events.id,
      schema.events.categoryId,
      schema.events.discipline,
      schema.events.division,
      schema.events.format,
      schema.events.status,
    );

  const liveRows = await db()
    .select({ eventId: schema.matches.eventId, liveCount: count(schema.matches.id) })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.tournamentId, tournament.id),
        eq(schema.matches.status, 'live'),
      ),
    )
    .groupBy(schema.matches.eventId);
  const liveByEvent = new Map(liveRows.map((r) => [r.eventId, r.liveCount]));

  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  const cells: GridCell[] = rows.map((r) => ({
    categoryId: r.categoryId,
    discipline: r.discipline as Discipline,
    status: r.status as CellStatus,
    format: FORMAT_MAP[r.format as keyof typeof FORMAT_MAP],
    entrantCount: r.entrantCount,
    liveCount: liveByEvent.get(r.eventId) ?? 0,
    href: `/t/${slug}/${slugById.get(r.categoryId) ?? ''}/${
      r.division === 'open' ? r.discipline : `${r.division}-${r.discipline}`
    }`,
  }));

  const totalEntrants = cells.reduce((sum, c) => sum + (c.entrantCount ?? 0), 0);
  const liveNow = cells.reduce((sum, c) => sum + (c.liveCount ?? 0), 0);

  // timeZone: 'UTC' is load-bearing. Tournament dates are plain calendar
  // dates stored as text; parsing them as UTC midnight and then formatting in
  // the server's local zone shifts every date back a day west of Greenwich.
  const dates =
    tournament.startDate === null
      ? null
      : new Intl.DateTimeFormat(intlLocale(locale), {
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        }).formatRange(
          new Date(`${tournament.startDate}T00:00:00Z`),
          new Date(`${tournament.endDate ?? tournament.startDate}T00:00:00Z`),
        );

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <Link href="/" className={styles.back}>
              ← {dict.allTournaments}
            </Link>
            <LanguageToggle active={locale} />
          </div>
          <p className={styles.meta}>
            {[tournament.venue, dates].filter(Boolean).join(' · ')}
          </p>
          <h1 className={styles.title}>{tournament.name}</h1>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{cells.length}</span>
              <span className={styles.statLabel}>{cells.length === 1 ? dict.draw : dict.draws}</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{totalEntrants}</span>
              <span className={styles.statLabel}>{dict.entrants}</span>
            </span>
            {liveNow > 0 && (
              <span className={styles.stat}>
                <span className={styles.statNumber}>{liveNow}</span>
                <span className={styles.statLabel}>{dict.liveNow}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <h2 className={styles.sectionTitle}>{dict.draws}</h2>
        <CategoryGrid categories={categories} cells={cells} mode="public" showNotRun labels={dict} />
      </div>
    </main>
  );
}
