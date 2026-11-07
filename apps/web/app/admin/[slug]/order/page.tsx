/**
 * OUT-2 — the order of play.
 *
 * The scheduler has been computing `scheduledAt` and `courtId` since SCH, and
 * nothing ever showed them: the schedule page configures court WINDOWS, the
 * bracket shows structure, and the one question a player actually asks —
 * "what time am I on, and which court?" — had no answer anywhere in the
 * product.
 *
 * Grouped by day, then ordered by time, then by court, because that is how
 * it gets read: somebody scans down to the next hour and across to their
 * court. Grouping by court first would make a single player's day a hunt
 * through several columns.
 *
 * Printable, like the draw sheet — this one goes next to it on the wall —
 * but portrait and a plain table, because a list of times is a list, not a
 * drawing. It is deliberately NOT the same route as the draw sheets: an
 * order of play is reprinted every morning as results come in, and the
 * brackets are not.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { drawLabel, type Discipline, type Division } from '@/lib/divisions';
import { outcomeAbbreviation } from '@/lib/match-result';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';
import { venueDateFormatter, venueTimeFormatter } from '@/lib/venue-time';
import { reconcileScheduleDisplay } from '@/lib/schedule-display';
import { PageHeader, PageBody } from '@/components/page-header';
import adminStyles from '../../admin.module.css';
import styles from './order.module.css';
import { roundLabel } from '@/lib/draw-text';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: { absolute: `${dict.orderOfPlay} · ${dict.adminEyebrow}` } };
}

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export default async function OrderOfPlayPage({ params }: Params) {
  const { slug } = await params;
  await requireUser(`/admin/${slug}/order`);
  const organizationId = orgId();

  const tournamentRows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      venue: schema.tournaments.venue,
      matchMinutes: schema.tournaments.matchMinutes,
      minRestMinutes: schema.tournaments.minRestMinutes,
    })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)))
    .limit(1);

  const tournament = tournamentRows[0];
  if (tournament === undefined) notFound();

  const locale = await currentLocale();
  const dict = dictionary(locale);

  const rows = await db()
    .select({
      id: schema.matches.id,
      eventId: schema.matches.eventId,
      scheduledAt: schema.matches.scheduledAt,
      status: schema.matches.status,
      outcome: schema.matches.outcome,
      winnerEntrantId: schema.matches.winnerEntrantId,
      completedAt: schema.matches.completedAt,
      courtName: schema.courts.name,
      roundName: schema.rounds.name,
      groupId: schema.rounds.groupId,
      categoryCode: schema.categories.code,
      discipline: schema.events.discipline,
      division: schema.events.division,
    })
    .from(schema.matches)
    .innerJoin(schema.events, eq(schema.events.id, schema.matches.eventId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .leftJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .leftJoin(schema.courts, eq(schema.courts.id, schema.matches.courtId))
    .where(eq(schema.matches.tournamentId, tournament.id))
    .orderBy(asc(schema.matches.scheduledAt));

  /*
   * How much of the tournament is NOT on this sheet. Printing a partial
   * order of play without saying so is how a player misses a match.
   *
   * Byes are excluded: nobody turns up for one, so it needs no time and
   * counting it would make a complete schedule look incomplete.
   */
  const sides = await db()
    .select({
      id: schema.matchSides.id,
      matchId: schema.matchSides.matchId,
      position: schema.matchSides.position,
      entrantId: schema.matchSides.entrantId,
      sourceKind: schema.matchSides.sourceKind,
      sourceMatchId: schema.matchSides.sourceMatchId,
      sourceGroupId: schema.matchSides.sourceGroupId,
    })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(eq(schema.matches.tournamentId, tournament.id))
    .orderBy(asc(schema.matchSides.position));

  const presentation = reconcileScheduleDisplay(
    rows,
    sides,
    new Map(
      rows.map((row) => [
        row.eventId,
        { matchMinutes: tournament.matchMinutes, minRestMinutes: tournament.minRestMinutes },
      ]),
    ),
  );
  const presentedRows = rows.map((row) => ({
    ...row,
    ...presentation.matches.get(row.id),
  }));
  const presentedSides = sides.map((side) => ({
    ...side,
    entrantId: presentation.sides.find((candidate) => candidate.id === side.id)?.entrantId ?? null,
  }));
  const noCourtMatches = new Set(
    presentedSides.filter((side) => side.sourceKind === 'bye').map((side) => side.matchId),
  );
  const listedRows = presentedRows.filter(
    (row) => row.scheduledAt !== null && !noCourtMatches.has(row.id) && row.status !== 'bye',
  );
  const unscheduledCount = presentedRows.filter(
    (row) =>
      row.scheduledAt === null &&
      !noCourtMatches.has(row.id) &&
      row.status !== 'bye',
  ).length;

  const playerRows = await db()
    .select({
      entrantId: schema.entrantPlayers.entrantId,
      lastName: schema.players.lastName,
    })
    .from(schema.entrantPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .where(eq(schema.events.tournamentId, tournament.id))
    .orderBy(asc(schema.entrantPlayers.position));

  const nameBy = new Map<string, string>();
  for (const r of playerRows) {
    const existing = nameBy.get(r.entrantId);
    nameBy.set(r.entrantId, existing === undefined ? r.lastName : `${existing} / ${r.lastName}`);
  }

  const sidesBy = new Map<string, Array<{ position: number; entrantId: string | null }>>();
  for (const s of presentedSides) {
    const list = sidesBy.get(s.matchId) ?? [];
    list.push({ position: s.position, entrantId: s.entrantId });
    sidesBy.set(s.matchId, list);
  }

  /*
   * The venue's zone, which is now safe to use: `scheduleMatches` converts
   * the engine's abstract wall clock into a real instant before storing it
   * (see lib/venue-time.ts). Rendering these in UTC would be eight hours
   * out in the other direction.
   */
  const dayFormatter = venueDateFormatter(locale);
  const timeFormatter = venueTimeFormatter(locale);

  interface Line {
    readonly id: string;
    readonly time: string;
    readonly court: string;
    readonly draw: string;
    readonly round: string;
    readonly a: string;
    readonly b: string;
    readonly note: string;
  }

  const days = new Map<string, Line[]>();
  for (const row of listedRows) {
    if (row.scheduledAt === null) continue;
    const when = new Date(row.scheduledAt);
    const dayKey = dayFormatter.format(when);
    const mySides = sidesBy.get(row.id) ?? [];
    const nameFor = (position: 0 | 1): string => {
      const side = mySides.find((s) => s.position === position);
      if (side?.entrantId == null) return '—';
      return nameBy.get(side.entrantId) ?? '—';
    };

    const line: Line = {
      id: row.id,
      time: timeFormatter.format(when),
      court: row.courtName ?? '—',
      draw: drawLabel(
        row.categoryCode,
        row.division as Division,
        row.discipline as Discipline,
        dict,
      ),
      // Translated: this sheet goes on the clubhouse wall and is read by
      // players, not by the organizer. Everything else on it — the day,
      // the column headings, "Resultados" — was already in their language.
      round: row.roundName === null ? '' : roundLabel(row.roundName, dict),
      a: nameFor(0),
      b: nameFor(1),
      note:
        row.status === 'complete'
          ? (outcomeAbbreviation(row.outcome) ?? dict.results)
          : row.status === 'live'
            ? dict.live
            : '',
    };

    const bucket = days.get(dayKey);
    if (bucket === undefined) days.set(dayKey, [line]);
    else bucket.push(line);
  }

  // Within a day: by time, then by court, so a reader scans down to the hour
  // and across to their court.
  for (const lines of days.values()) {
    lines.sort((x, y) => (x.time === y.time ? x.court.localeCompare(y.court) : x.time.localeCompare(y.time)));
  }

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title={dict.orderOfPlay}
        lead={
          listedRows.length === 0
            ? dict.orderOfPlayEmptyLead
            : dict.orderOfPlayLead
        }
        facts={[
          {
            value: listedRows.length,
            label:
              listedRows.length === 1
                ? dict.matchCount1
                : fill(dict.matchCountN, { n: String(listedRows.length) }),
          },
          ...(unscheduledCount > 0
            ? [{ value: unscheduledCount, label: dict.notScheduled, emphasis: true }]
            : []),
        ]}
      />

      <PageBody>
        {listedRows.length === 0 ? (
          <p className={styles.empty}>{dict.nothingScheduled}</p>
        ) : (
          <>
            <div className={styles.sheetHead}>
              <p className={styles.tournament}>{tournament.name}</p>
              {tournament.venue !== null && (
                <p className={styles.venue}>{tournament.venue}</p>
              )}
            </div>

            {unscheduledCount > 0 && (
              <p className={styles.partial}>
                {unscheduledCount === 1
                  ? dict.unscheduled1
                  : fill(dict.unscheduledN, { n: String(unscheduledCount) })}
              </p>
            )}

            {[...days.entries()].map(([day, lines]) => (
              <section key={day} className={styles.day}>
                <h2 className={styles.dayName}>{day}</h2>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th} scope="col">{dict.time}</th>
                      <th className={styles.th} scope="col">{dict.court}</th>
                      <th className={styles.th} scope="col">{dict.draw}</th>
                      <th className={styles.th} scope="col">{dict.match}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className={styles.tr}>
                        <td className={styles.time}>{line.time}</td>
                        <td className={styles.court}>{line.court}</td>
                        <td className={styles.draw}>
                          <span className={styles.drawName}>{line.draw}</span>
                          {line.round !== '' && <span className={styles.round}>{line.round}</span>}
                        </td>
                        <td className={styles.players}>
                          <span className={styles.side}>{line.a}</span>
                          <span className={styles.versus}>v</span>
                          <span className={styles.side}>{line.b}</span>
                          {line.note !== '' && <span className={styles.note}>{line.note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </>
        )}
      </PageBody>
    </main>
  );
}
