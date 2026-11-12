'use server';

import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { schema } from '@opentennis/db';
import { scheduleMatches, weeklyCapacity, type SchedulableMatch } from '@opentennis/engine';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import { wallClockToInstant } from '@/lib/venue-time';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';
import { adaptSchedulingMatches } from '@/lib/scheduling-adapter';
import { parseScheduleWindows } from '@/lib/schedule-windows';
import { reconcileByeAdvances } from '@/lib/bye-advance';

export interface ScheduleState {
  readonly error?: string;
  readonly summary?: string;
  readonly warnings?: readonly string[];
  readonly perWeek?: number;
}

/**
 * How many days the tournament runs, inclusive of both ends.
 *
 * Falls back to a long horizon when no end date is set — a club that has
 * not said when the tournament finishes has not asked to be constrained.
 */
function daysInclusive(startDate: string, endDate: string | null): number {
  if (endDate === null) return 120;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 120;
  const span = Math.floor((end - start) / 86_400_000) + 1;
  // An end before the start is a typo, not an instruction to schedule
  // nothing; one day is the smallest honest answer.
  return span < 1 ? 1 : span;
}

export async function saveAndSchedule(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  await requireCapability('draws:manage');
  const organizationId = orgId();
  const slug = String(formData.get('slug') ?? '');
  const locale = await currentLocale();
  const dict = dictionary(locale);

  const courtCount = Number(formData.get('courtCount') ?? 2);
  const matchMinutes = Number(formData.get('matchMinutes') ?? 60);
  const minRestMinutes = Number(formData.get('minRestMinutes') ?? 60);

  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 40) {
    return { error: dict.scheduleCourtsRangeError };
  }
  if (!Number.isInteger(matchMinutes) || matchMinutes < 15) {
    return { error: dict.scheduleMinMatchDurationError };
  }

  const windowResult = parseScheduleWindows(formData, locale);
  if (!windowResult.ok) return { error: windowResult.error };
  const { windows } = windowResult;

  const tournaments = await db()
    .select({
      id: schema.tournaments.id,
      startDate: schema.tournaments.startDate,
      endDate: schema.tournaments.endDate,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);

  const tournament = tournaments[0];
  if (tournament === undefined) return { error: dict.entryNotFound };

  await db()
    .update(schema.tournaments)
    .set({
      courtCount,
      matchMinutes,
      minRestMinutes,
      availabilityWindows: windows,
      updatedAt: new Date(),
    })
    .where(eq(schema.tournaments.id, tournament.id));

  // Load every match with its round depth and the entrants it could involve.
  const rows = await db()
    .select({
      id: schema.matches.id,
      eventId: schema.matches.eventId,
      status: schema.matches.status,
      winnerEntrantId: schema.matches.winnerEntrantId,
      roundIndex: schema.rounds.roundIndex,
      groupId: schema.rounds.groupId,
      stageId: schema.rounds.stageId,
    })
    .from(schema.matches)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .where(eq(schema.matches.tournamentId, tournament.id));

  if (rows.length === 0) {
    return { error: dict.scheduleNoDraws };
  }

  const sides = await db()
    .select({
      id: schema.matchSides.id,
      matchId: schema.matchSides.matchId,
      entrantId: schema.matchSides.entrantId,
      sourceKind: schema.matchSides.sourceKind,
      sourceMatchId: schema.matchSides.sourceMatchId,
      sourceGroupId: schema.matchSides.sourceGroupId,
    })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(eq(schema.matches.tournamentId, tournament.id));

  const reconciliation = reconcileByeAdvances(rows, sides);
  for (const update of reconciliation.sideUpdates) {
    await db()
      .update(schema.matchSides)
      .set({ entrantId: update.entrantId })
      .where(eq(schema.matchSides.id, update.id));
  }
  for (const update of reconciliation.matchUpdates) {
    await db()
      .update(schema.matches)
      .set({
        status: update.status,
        winnerEntrantId: update.winnerEntrantId,
        updatedAt: new Date(),
      })
      .where(eq(schema.matches.id, update.id));
  }

  const reconciledSides = sides.map((side) => {
    const update = reconciliation.sideUpdates.find((candidate) => candidate.id === side.id);
    return update === undefined ? side : { ...side, entrantId: update.entrantId };
  });
  const reconciledRows = rows.map((row) => {
    const update = reconciliation.matchUpdates.find((candidate) => candidate.id === row.id);
    return update === undefined
      ? row
      : { ...row, status: update.status, winnerEntrantId: update.winnerEntrantId };
  });
  const matches: SchedulableMatch[] = adaptSchedulingMatches(reconciledRows, reconciledSides);

  const startDate = tournament.startDate ?? new Date().toISOString().slice(0, 10);

  /*
   * The tournament's own length, not an arbitrary 120 days.
   *
   * This was hardcoded, so a three-day tournament got a six-day order of
   * play: matches on the Monday and Tuesday after everyone had gone home,
   * on courts the club had not booked. The engine already reports what
   * does not fit — "N matches could not be placed within X days" — so
   * capping here turns a silently wrong schedule into a visible "you need
   * more courts or more hours", which is the decision the organizer
   * actually has to make.
   *
   * Dates are plain calendar strings; parsed as UTC so the span does not
   * shift a day west of Greenwich.
   */
  const maxDays = daysInclusive(startDate, tournament.endDate);

  const config = {
    courtCount,
    windows,
    matchMinutes,
    startDate,
    maxDays,
    minRestMinutes,
  };

  const result = scheduleMatches(matches, config);

  /*
   * Courts are real rows, created on demand.
   *
   * The engine assigns every match a `courtIndex` — it has to, or it could
   * not stop two matches sharing a court — and that assignment used to be
   * thrown away here: only `scheduledAt` was written, `courtId` stayed null,
   * and the `courts` table was never populated at all. The scheduler was
   * therefore promising that N matches run in parallel without anyone being
   * able to find out WHICH court to walk to, which is half of what an order
   * of play is for.
   *
   * Names default to "Cancha 1..N" — Mexican Spanish, because this string is
   * read by players on the wall sheet, not by the organizer in the admin.
   */
  const existingCourts = await db()
    .select({ id: schema.courts.id, sortOrder: schema.courts.sortOrder })
    .from(schema.courts)
    .where(eq(schema.courts.tournamentId, tournament.id))
    .orderBy(asc(schema.courts.sortOrder));

  const courtIdByIndex = new Map<number, string>();
  for (const court of existingCourts) courtIdByIndex.set(court.sortOrder, court.id);

  for (let index = 0; index < courtCount; index += 1) {
    if (courtIdByIndex.has(index)) continue;
    const [created] = await db()
      .insert(schema.courts)
      .values({
        organizationId,
        tournamentId: tournament.id,
        name: `Cancha ${index + 1}`,
        sortOrder: index,
      })
      .onConflictDoNothing()
      .returning({ id: schema.courts.id });

    if (created !== undefined) {
      courtIdByIndex.set(index, created.id);
    } else {
      // Name already taken on this tournament (the unique constraint), so
      // adopt the existing row rather than leaving the index unmapped.
      const [found] = await db()
        .select({ id: schema.courts.id })
        .from(schema.courts)
        .where(
          and(
            eq(schema.courts.tournamentId, tournament.id),
            eq(schema.courts.name, `Cancha ${index + 1}`),
          ),
        )
        .limit(1);
      if (found !== undefined) courtIdByIndex.set(index, found.id);
    }
  }

  /*
   * `startsAt` carries the intended WALL-CLOCK time in its UTC fields, because
   * the engine is timezone-free by design. Converting here is what makes the
   * timestamptz column mean a real instant — stored raw, a 10:00 court window
   * became 10:00Z, which is 02:00 in Mexicali.
   */
  /*
   * Wipe the whole tournament's times FIRST, then write the new ones.
   *
   * Only byes were cleared before, so rescheduling was additive: a match
   * placed by an earlier run and dropped by this one — because the courts
   * changed, or because the run is now capped at the tournament's end
   * date — kept its old time. The order of play then showed a schedule
   * that no run had ever produced, mixing Friday's new times with the
   * previous attempt's Tuesday. Regenerating has to mean regenerating.
   */
  await db()
    .update(schema.matches)
    .set({ scheduledAt: null, courtId: null })
    .where(eq(schema.matches.tournamentId, tournament.id));

  for (const s of result.scheduled) {
    await db()
      .update(schema.matches)
      .set({
        scheduledAt: wallClockToInstant(new Date(s.startsAt)),
        courtId: courtIdByIndex.get(s.courtIndex) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.matches.id, s.matchId));
  }

  revalidatePath(`/admin/${slug}/schedule`);
  revalidatePath(`/t/${slug}`, 'layout');

  const total = result.scheduled.length + result.unscheduled.length;
  const scheduledDays = result.lastDay === null ? 0 : daysInclusive(startDate, result.lastDay);
  const summary = fill(dict.scheduleSummary, {
    scheduled: String(result.scheduled.length),
    total: String(total),
    matches: (total === 1 ? dict.match : dict.matches).toLowerCase(),
    courts: String(courtCount),
    days: String(scheduledDays),
  });
  const warnings = [
    ...(result.unscheduled.length === 0
      ? []
      : [
          result.unscheduled.length === 1
            ? fill(dict.scheduleUnplaced1, { days: String(config.maxDays) })
            : fill(dict.scheduleUnplacedN, {
                n: String(result.unscheduled.length),
                days: String(config.maxDays),
              }),
        ]),
    ...(result.finalSpreadDays > 2
      ? [fill(dict.scheduleSpread, { days: String(result.finalSpreadDays) })]
      : []),
  ];

  return {
    summary: `${summary}${
      result.finalDayByEvent.size > 1
        ? fill(dict.scheduleFinalsWithin, { days: String(result.finalSpreadDays) })
        : '.'
    }`,
    warnings,
    perWeek: weeklyCapacity(config),
  };
}
