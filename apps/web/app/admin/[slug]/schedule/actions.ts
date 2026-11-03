'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { schema } from '@opentennis/db';
import {
  scheduleMatches,
  weeklyCapacity,
  type SchedulableMatch,
  type TimeWindow,
} from '@opentennis/engine';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export interface ScheduleState {
  readonly error?: string;
  readonly summary?: string;
  readonly warnings?: readonly string[];
  readonly perWeek?: number;
}

/** "06:00" → 360. Returns null for anything that is not a time of day. */
function toMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (m === null) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || h * 60 + min > 24 * 60) return null;
  return h * 60 + min;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

export async function saveAndSchedule(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  await requireUser();
  const organizationId = orgId();
  const slug = String(formData.get('slug') ?? '');

  const courtCount = Number(formData.get('courtCount') ?? 2);
  const matchMinutes = Number(formData.get('matchMinutes') ?? 60);
  const minRestMinutes = Number(formData.get('minRestMinutes') ?? 60);

  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 40) {
    return { error: 'Courts must be between 1 and 40.' };
  }
  if (!Number.isInteger(matchMinutes) || matchMinutes < 15) {
    return { error: 'Allow at least 15 minutes per match.' };
  }

  // Three editable bands: weekday morning, weekday evening, weekend.
  const bands: Array<{ days: number[]; from: string; to: string }> = [
    { days: WEEKDAYS, from: 'weekdayAmFrom', to: 'weekdayAmTo' },
    { days: WEEKDAYS, from: 'weekdayPmFrom', to: 'weekdayPmTo' },
    { days: WEEKEND, from: 'weekendFrom', to: 'weekendTo' },
  ];

  const windows: TimeWindow[] = [];
  for (const band of bands) {
    const from = String(formData.get(band.from) ?? '');
    const to = String(formData.get(band.to) ?? '');
    // An empty band means "we do not play then", which is valid.
    if (from === '' || to === '') continue;

    const startMinutes = toMinutes(from);
    const endMinutes = toMinutes(to);
    if (startMinutes === null || endMinutes === null) {
      return { error: `"${from}–${to}" is not a valid time range.` };
    }
    if (endMinutes <= startMinutes) {
      return { error: `A session must end after it starts (${from}–${to}).` };
    }
    for (const day of band.days) windows.push({ dayOfWeek: day, startMinutes, endMinutes });
  }

  if (windows.length === 0) {
    return { error: 'Add at least one playing session.' };
  }

  const tournaments = await db()
    .select({
      id: schema.tournaments.id,
      startDate: schema.tournaments.startDate,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);

  const tournament = tournaments[0];
  if (tournament === undefined) return { error: 'Tournament not found.' };

  await db()
    .update(schema.tournaments)
    .set({ courtCount, matchMinutes, minRestMinutes, availabilityWindows: windows, updatedAt: new Date() })
    .where(eq(schema.tournaments.id, tournament.id));

  // Load every match with its round depth and the entrants it could involve.
  const rows = await db()
    .select({
      id: schema.matches.id,
      eventId: schema.matches.eventId,
      status: schema.matches.status,
      roundIndex: schema.rounds.roundIndex,
      stageId: schema.rounds.stageId,
    })
    .from(schema.matches)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .where(eq(schema.matches.tournamentId, tournament.id));

  if (rows.length === 0) {
    return { error: 'No draws have been generated yet, so there is nothing to schedule.' };
  }

  const sides = await db()
    .select({ matchId: schema.matchSides.matchId, entrantId: schema.matchSides.entrantId })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(eq(schema.matches.tournamentId, tournament.id));

  const knownByMatch = new Map<string, string[]>();
  for (const s of sides) {
    if (s.entrantId === null) continue;
    knownByMatch.set(s.matchId, [...(knownByMatch.get(s.matchId) ?? []), s.entrantId]);
  }

  const roundsInEvent = new Map<string, number>();
  for (const r of rows) {
    roundsInEvent.set(r.eventId, Math.max(roundsInEvent.get(r.eventId) ?? 0, r.roundIndex + 1));
  }

  // Everyone in the event stands in as the potential field for a later round,
  // because a player cannot be double-booked into a match we cannot resolve.
  const eventEntrants = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = eventEntrants.get(r.eventId) ?? new Set<string>();
    for (const id of knownByMatch.get(r.id) ?? []) set.add(id);
    eventEntrants.set(r.eventId, set);
  }

  const matches: SchedulableMatch[] = rows.map((r) => {
    const known = knownByMatch.get(r.id) ?? [];
    return {
      id: r.id,
      eventId: r.eventId,
      roundIndex: r.roundIndex,
      roundsInEvent: roundsInEvent.get(r.eventId) ?? 1,
      isBye: r.status === 'bye',
      potentialEntrantIds: known.length > 0 ? known : [...(eventEntrants.get(r.eventId) ?? [])],
      dependsOn: [],
    };
  });

  const config = {
    courtCount,
    windows,
    matchMinutes,
    startDate: tournament.startDate ?? new Date().toISOString().slice(0, 10),
    maxDays: 120,
    minRestMinutes,
  };

  const result = scheduleMatches(matches, config);

  // Persist. Court index 0 becomes "Court 1" for a human.
  for (const s of result.scheduled) {
    await db()
      .update(schema.matches)
      .set({ scheduledAt: new Date(s.startsAt), updatedAt: new Date() })
      .where(eq(schema.matches.id, s.matchId));
  }
  await db()
    .update(schema.matches)
    .set({ scheduledAt: null })
    .where(
      and(
        eq(schema.matches.tournamentId, tournament.id),
        eq(schema.matches.status, 'bye'),
        sql`true`,
      ),
    );

  revalidatePath(`/admin/${slug}/schedule`);
  revalidatePath(`/t/${slug}`, 'layout');

  return {
    summary: result.description,
    warnings: result.warnings,
    perWeek: weeklyCapacity(config),
  };
}
