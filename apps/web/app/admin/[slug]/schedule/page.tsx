import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, count, eq, exists, isNotNull, ne, not, sql } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { ScheduleForm } from './schedule-form';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from './schedule.module.css';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, intlLocale } from '@/lib/i18n/dictionaries';
import { tournamentCalendarDateFormatter } from '@/lib/venue-time';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const dict = dictionary(locale);
  return { title: dict.scheduleTitle };
}

interface Params {
  readonly params: Promise<{ slug: string }>;
}

/** 360 → "06:00", for an <input type="time">. */
function toTimeValue(minutes: number | undefined): string {
  if (minutes === undefined) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export default async function SchedulePage({ params }: Params) {
  const { slug } = await params;
  await requireUser(`/admin/${slug}/schedule`);

  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      startDate: schema.tournaments.startDate,
      courtCount: schema.tournaments.courtCount,
      matchMinutes: schema.tournaments.matchMinutes,
      minRestMinutes: schema.tournaments.minRestMinutes,
      windows: schema.tournaments.availabilityWindows,
    })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)))
    .limit(1);

  const tournament = rows[0];
  if (tournament === undefined) notFound();
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const formattedStartDate =
    tournament.startDate === null
      ? null
      : tournamentCalendarDateFormatter(intlLocale(locale), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(`${tournament.startDate}T00:00:00Z`));

  /*
   * Byes excluded, as on the order of play. Nobody turns up for a bye, so
   * the scheduler never gives one a time — counting them here made a
   * fully-scheduled tournament read "57 matches, 35 scheduled" forever,
   * and put a different total on this page than on the one next to it.
   */
  const [totals] = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(and(eq(schema.matches.tournamentId, tournament.id), ne(schema.matches.status, 'bye')));

  /*
   * OT-8. "Scheduled" has to mean the same thing here as on the order of
   * play, and it did not: this page said 35 scheduled while the sheet
   * listed 34.
   *
   * Neither was wrong about its own question. The order sheet drops a
   * match fed by a BYE — the survivor advances without playing, so it
   * occupies no court and belongs on no clubhouse wall (OT-1). This
   * counted it, because it has a `scheduledAt` like any other row. One
   * word, two scopes, two numbers.
   *
   * Resolved in favour of the sheet: a match nobody turns up for is not
   * scheduled in any sense a player or an organizer means. The TOTAL
   * above still counts it, so the header now reads "35 partidos / 34
   * programados" — which is the true state, and says where the odd one
   * went rather than hiding it.
   */
  const [scheduled] = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.tournamentId, tournament.id),
        // Also excludes a bye still holding a `scheduledAt` left behind by
        // an earlier generation.
        ne(schema.matches.status, 'bye'),
        isNotNull(schema.matches.scheduledAt),
        not(
          exists(
            db()
              .select({ one: sql`1` })
              .from(schema.matchSides)
              .where(
                and(
                  eq(schema.matchSides.matchId, schema.matches.id),
                  eq(schema.matchSides.sourceKind, 'bye'),
                ),
              ),
          ),
        ),
      ),
    );

  // Saved windows, grouped back into the three editable bands.
  const saved = (tournament.windows ?? []) as Array<{
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
  }>;
  const weekday = saved.filter((w) => w.dayOfWeek >= 1 && w.dayOfWeek <= 5);
  const weekend = saved.filter((w) => w.dayOfWeek === 0 || w.dayOfWeek === 6);
  const weekdayBands = [...new Set(weekday.map((w) => `${w.startMinutes}-${w.endMinutes}`))]
    .map((k) => k.split('-').map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0]);

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title={dict.scheduleTitle}
        facts={[
          { value: totals?.n ?? 0, label: dict.matches },
          { value: scheduled?.n ?? 0, label: dict.scheduled },
        ]}
      />

      <PageBody>
        <ScheduleForm
          slug={slug}
          startDate={formattedStartDate}
          courtCount={tournament.courtCount}
          matchMinutes={tournament.matchMinutes}
          minRestMinutes={tournament.minRestMinutes}
          dict={dict}
          weekdayAm={{
            from: toTimeValue(weekdayBands[0]?.[0]),
            to: toTimeValue(weekdayBands[0]?.[1]),
          }}
          weekdayPm={{
            from: toTimeValue(weekdayBands[1]?.[0]),
            to: toTimeValue(weekdayBands[1]?.[1]),
          }}
          weekend={{
            from: toTimeValue(weekend[0]?.startMinutes),
            to: toTimeValue(weekend[0]?.endMinutes),
          }}
        />
      </PageBody>
    </main>
  );
}
