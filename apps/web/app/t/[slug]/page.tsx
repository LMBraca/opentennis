/** Public tournament overview and category hub. */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { and, asc, count, eq, inArray, ne } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { CategoryGrid, type GridCell, type GridCategory } from '@/components/category-grid';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import { SiteNav } from '@/components/site-nav';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill, intlLocale } from '@/lib/i18n/dictionaries';
import { tournamentCalendarDateFormatter } from '@/lib/venue-time';
import { isOfferedButNotGenerated } from '@/lib/category-grid-state';
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
      visibility: schema.tournaments.visibility,
      entriesOpen: schema.tournaments.entriesOpen,
      venue: schema.tournaments.venue,
      courtCount: schema.tournaments.courtCount,
      startDate: schema.tournaments.startDate,
      endDate: schema.tournaments.endDate,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);
  return rows[0];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await loadTournament(slug);
  const dict = dictionary(await currentLocale());
  return {
    title:
      tournament === undefined || tournament.visibility === 'draft'
        ? dict.notFoundTitle
        : tournament.name,
  };
}

export default async function TournamentPage({ params }: Params) {
  const { slug } = await params;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const tournament = await loadTournament(slug);

  // A draft tournament is not public. 404 rather than 403: the existence of
  // an unpublished draw is itself not public information.
  if (tournament === undefined || tournament.visibility === 'draft') notFound();

  const categories = await db()
    .select({
      id: schema.categories.id,
      code: schema.categories.code,
      slug: schema.categories.slug,
      rank: schema.categories.rank,
    })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, orgId()))
    .orderBy(asc(schema.categories.rank));

  const events = await db()
    .select({
      id: schema.events.id,
      categoryId: schema.events.categoryId,
      categorySlug: schema.categories.slug,
      division: schema.events.division,
      discipline: schema.events.discipline,
      format: schema.events.format,
      status: schema.events.status,
    })
    .from(schema.events)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(eq(schema.events.tournamentId, tournament.id));

  const eventIds = events.map((event) => event.id);
  const entrants =
    eventIds.length === 0
      ? []
      : await db()
          .select({ eventId: schema.entrants.eventId, total: count(schema.entrants.id) })
          .from(schema.entrants)
          .where(and(inArray(schema.entrants.eventId, eventIds), eq(schema.entrants.status, 'active')))
          .groupBy(schema.entrants.eventId);
  const matches = await db()
    .select({ eventId: schema.matches.eventId, total: count(schema.matches.id) })
    .from(schema.matches)
    .where(and(eq(schema.matches.tournamentId, tournament.id), ne(schema.matches.status, 'bye')))
    .groupBy(schema.matches.eventId);
  const entrantsByEvent = new Map(entrants.map((row) => [row.eventId, row.total]));
  const matchesByEvent = new Map(matches.map((row) => [row.eventId, row.total]));
  const dateRange =
    tournament.startDate === null
      ? null
      : tournamentCalendarDateFormatter(intlLocale(locale), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).formatRange(
          new Date(`${tournament.startDate}T00:00:00Z`),
          new Date(`${tournament.endDate ?? tournament.startDate}T00:00:00Z`),
        );
  const divisions = ['open', 'mens', 'womens'] as const;
  const divisionLabel = {
    open: dict.divisionOpen,
    mens: dict.divisionMensLabel,
    womens: dict.divisionWomensLabel,
  } as const;
  const gridLabels = {
    singles: dict.singles,
    doubles: dict.doubles,
    entrant: dict.entrant,
    entrants: dict.entrants,
    roundRobin: dict.roundRobin,
    singleElim: dict.singleElim,
    groupsPlayoff: dict.groupsPlayoff,
    notHeld: dict.notHeld,
    noDraws: dict.noDraws,
    notGenerated: dict.notGenerated,
  };
  const categoriesForGrid: GridCategory[] = categories;
  const cellsFor = (division: (typeof divisions)[number]): GridCell[] =>
    events
      .filter((event) => event.division === division)
      .map((event) => {
        const hasDraw = (matchesByEvent.get(event.id) ?? 0) > 0;
        const isPubliclyDrawn = hasDraw && ['published', 'inProgress', 'complete'].includes(event.status);
        const isUnGeneratedDraft = isOfferedButNotGenerated(
          event.status,
          matchesByEvent.get(event.id) ?? 0,
          entrantsByEvent.get(event.id) ?? 0,
        );
        const segment = division === 'open' ? event.discipline : `${division}-${event.discipline}`;
        return {
          categoryId: event.categoryId,
          discipline: event.discipline as 'singles' | 'doubles',
          status: event.status as GridCell['status'],
          ...(event.format === null ? {} : { format: event.format as NonNullable<GridCell['format']> }),
          entrantCount: entrantsByEvent.get(event.id) ?? 0,
          hasDraw,
          ...(isPubliclyDrawn || isUnGeneratedDraft
            ? { href: `/t/${slug}/${event.categorySlug}/${segment}` }
            : {}),
        };
      });
  const canEnter = tournament.entriesOpen && events.some((event) => event.status !== 'notRun');

  return (
    <main className={styles.page}>
      <PageHeader
        title={tournament.name}
        nav={<SiteNav dict={dict} />}
        actions={<LanguageToggle active={locale} />}
        {...(dateRange === null ? {} : { lead: dateRange })}
      />
      <PageBody>
        <div className={styles.details}>
          {tournament.venue !== null && (
            <span>{dict.venueLabel}: {tournament.venue}</span>
          )}
          {tournament.courtCount > 0 && (
            <span>{fill(dict.courtCountLabel, { n: String(tournament.courtCount) })}</span>
          )}
        </div>
        <p className={styles.entryState}>
          {tournament.entriesOpen ? dict.entriesOpenLabel : dict.entriesClosed}
        </p>
        {canEnter && (
          <Link className={styles.entryLink} href={`/t/${slug}/enter`}>
            {dict.enterButton}
          </Link>
        )}
        {divisions.map((division) => {
          const cells = cellsFor(division);
          if (cells.length === 0) return null;
          return (
            <section key={division}>
              <h2 className={styles.division}>{divisionLabel[division]}</h2>
              <CategoryGrid
                categories={categoriesForGrid}
                cells={cells}
                showNotRun
                labels={gridLabels}
              />
            </section>
          );
        })}
        {events.length === 0 && <p className={styles.empty}>{dict.noDraws}</p>}
        <SiteFooter />
      </PageBody>
    </main>
  );
}
