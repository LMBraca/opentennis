import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, count, eq, isNotNull } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { ScheduleForm } from './schedule-form';
import styles from './schedule.module.css';

export const metadata: Metadata = { title: 'Courts & schedule' };
export const dynamic = 'force-dynamic';

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
    .where(
      and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);

  const tournament = rows[0];
  if (tournament === undefined) notFound();

  const [totals] = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(eq(schema.matches.tournamentId, tournament.id));

  const [scheduled] = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.tournamentId, tournament.id),
        isNotNull(schema.matches.scheduledAt),
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
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <Link href="/admin" className={styles.back}>
            ← Admin
          </Link>
          <h1 className={styles.title}>Courts &amp; schedule</h1>
          <p className={styles.sub}>{tournament.name}</p>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{totals?.n ?? 0}</span>
              <span className={styles.statLabel}>Matches</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{scheduled?.n ?? 0}</span>
              <span className={styles.statLabel}>Scheduled</span>
            </span>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <ScheduleForm
          slug={slug}
          startDate={tournament.startDate}
          courtCount={tournament.courtCount}
          matchMinutes={tournament.matchMinutes}
          minRestMinutes={tournament.minRestMinutes}
          weekdayAm={{
            from: toTimeValue(weekdayBands[0]?.[0]) || '06:00',
            to: toTimeValue(weekdayBands[0]?.[1]) || '08:00',
          }}
          weekdayPm={{
            from: toTimeValue(weekdayBands[1]?.[0]) || '18:00',
            to: toTimeValue(weekdayBands[1]?.[1]) || '22:00',
          }}
          weekend={{
            from: toTimeValue(weekend[0]?.startMinutes) || '10:00',
            to: toTimeValue(weekend[0]?.endMinutes) || '16:00',
          }}
        />
      </div>
    </main>
  );
}
