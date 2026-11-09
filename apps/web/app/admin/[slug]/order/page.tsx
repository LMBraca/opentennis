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
import Link from 'next/link';
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
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * RV-11. The axis and the filter live in the URL, not in component state.
 *
 * Three reasons, all of them specific to this page. It stays a server
 * component, so the sheet keeps rendering without client JavaScript — the
 * same call the draw sheet makes, and this page is printed off the wall
 * every morning. A filtered view can be bookmarked or sent to someone
 * ("here is just C+"). And printing captures whatever is on screen, so the
 * organizer prints the view they chose rather than the default.
 */
type Axis = 'time' | 'court';

function readAxis(value: string | string[] | undefined): Axis {
  return value === 'court' ? 'court' : 'time';
}

function readFilter(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || value === '' || value === 'all') return null;
  return value;
}

export default async function OrderOfPlayPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const query = await searchParams;
  const axis = readAxis(query['view']);
  const drawFilter = readFilter(query['draw']);
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
    /** Stable key for the draw filter: category code + discipline. */
    readonly drawKey: string;
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
      drawKey: `${row.categoryCode}-${row.discipline}`,
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

  /*
   * Within a day, the sort order follows the chosen axis.
   *
   * `time` is the default and the original behaviour: down to the hour,
   * across to the court, which is how a player reads the sheet on the wall.
   * `court` is the organizer's view — everything happening on Cancha 2, in
   * order — which answers "who is next here" without scanning the whole day.
   */
  for (const lines of days.values()) {
    lines.sort((x, y) =>
      axis === 'court'
        ? x.court === y.court
          ? x.time.localeCompare(y.time)
          : x.court.localeCompare(y.court, undefined, { numeric: true })
        : x.time === y.time
          ? x.court.localeCompare(y.court, undefined, { numeric: true })
          : x.time.localeCompare(y.time),
    );
  }

  /*
   * Every draw that has a scheduled match, for the filter. Built from the
   * lines rather than from the events table on purpose: a category with
   * nothing scheduled yet would be a filter option that leads to an empty
   * sheet, which reads as a bug.
   */
  const drawOptions = new Map<string, string>();
  for (const lines of days.values()) {
    for (const line of lines) drawOptions.set(line.drawKey, line.draw);
  }

  /*
   * Filter for display only, after the options are collected — otherwise
   * choosing a draw collapses the filter to the one draw you chose and
   * there is no way back to the others. Days that empty out are dropped
   * rather than left as a heading over nothing.
   */
  const visibleDays = new Map<string, Line[]>();
  for (const [day, lines] of days) {
    const kept = drawFilter === null ? lines : lines.filter((l) => l.drawKey === drawFilter);
    if (kept.length > 0) visibleDays.set(day, kept);
  }
  const visibleCount = [...visibleDays.values()].reduce((n, lines) => n + lines.length, 0);

  const href = (next: { axis?: Axis; draw?: string | null }): string => {
    const nextAxis = next.axis ?? axis;
    const nextDraw = next.draw === undefined ? drawFilter : next.draw;
    const qs = new URLSearchParams();
    if (nextAxis !== 'time') qs.set('view', nextAxis);
    if (nextDraw !== null) qs.set('draw', nextDraw);
    const query = qs.toString();
    return query === '' ? `/admin/${slug}/order` : `/admin/${slug}/order?${query}`;
  };

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
            /*
             * RV-11: the count follows the filter. "34 programados" above
             * six rows of C+ is the kind of number that makes an organizer
             * distrust the page.
             */
            value: drawFilter === null ? listedRows.length : visibleCount,
            /*
             * OT-8. These are the matches WITH A TIME on this sheet, not
             * every match in the tournament — a match fed by a bye is
             * deliberately absent, because nobody turns up for it. The
             * label said plain "Partidos", so this page and the schedule
             * page showed the same word over different numbers.
             */
            label: dict.scheduled,
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

            {/*
              RV-11. Links, not a <select> — a select needs JavaScript to
              navigate on change, and this page deliberately ships none.
              Hidden when printing: the sheet on the wall should not carry
              the controls used to produce it.
            */}
            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>{dict.groupBy}</span>
                <Link
                  href={href({ axis: 'time' })}
                  className={styles.control}
                  data-active={axis === 'time' ? 'true' : undefined}
                  aria-current={axis === 'time' ? 'true' : undefined}
                >
                  {dict.time}
                </Link>
                <Link
                  href={href({ axis: 'court' })}
                  className={styles.control}
                  data-active={axis === 'court' ? 'true' : undefined}
                  aria-current={axis === 'court' ? 'true' : undefined}
                >
                  {dict.court}
                </Link>
              </div>

              {drawOptions.size > 1 && (
                <div className={styles.controlGroup}>
                  <span className={styles.controlLabel}>{dict.draw}</span>
                  <Link
                    href={href({ draw: null })}
                    className={styles.control}
                    data-active={drawFilter === null ? 'true' : undefined}
                    aria-current={drawFilter === null ? 'true' : undefined}
                  >
                    {dict.allDraws}
                  </Link>
                  {[...drawOptions.entries()].map(([key, label]) => (
                    <Link
                      key={key}
                      href={href({ draw: key })}
                      className={styles.control}
                      data-active={drawFilter === key ? 'true' : undefined}
                      aria-current={drawFilter === key ? 'true' : undefined}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {visibleCount === 0 ? (
              <p className={styles.empty}>{dict.nothingScheduled}</p>
            ) : null}

            {[...visibleDays.entries()].map(([day, lines]) => (
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
