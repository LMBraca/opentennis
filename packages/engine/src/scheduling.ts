/**
 * Court scheduling.
 *
 * Packs every match from every category onto a fixed number of courts, inside
 * the hours a club actually has available, one match per slot.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ THE BALANCE RULE. Matches are ordered by TARGET FRACTION, not by round. │
 * │                                                                         │
 * │   targetFraction = (roundIndex + 1) / roundsInEvent                     │
 * │                                                                         │
 * │ A 5-round D draw and a 3-round Open round robin both finish at 1.0, so  │
 * │ sorting by this fraction interleaves them: D's round 1 (0.2) is played  │
 * │ before Open's round 1 (0.33), and every event's final lands in the same │
 * │ stretch of days. Sorting by round index instead would run every event's │
 * │ round 1 first and leave the short events finished a week early.         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Two things this is NOT:
 *
 *   - Not optimal. Resource-constrained project scheduling is NP-hard; this
 *     is a greedy pass over slots in time order. For a club weekend that is
 *     the right trade — an organizer wants a plan in a second, not a proof.
 *   - Not final. Past round one a bracket's occupants are unknown, so any
 *     up-front plan is provisional. It is expected to be re-run as results
 *     arrive, which is why it is a pure function of current state.
 */

import { engineError } from './errors';

/** Minutes from midnight. 6am is 360. */
export type MinuteOfDay = number;

export interface TimeWindow {
  /** 0 = Sunday … 6 = Saturday, matching Date#getUTCDay. */
  readonly dayOfWeek: number;
  readonly startMinutes: MinuteOfDay;
  readonly endMinutes: MinuteOfDay;
}

export interface SchedulingConfig {
  readonly courtCount: number;
  readonly windows: readonly TimeWindow[];
  /** Court time per match, including changeover. */
  readonly matchMinutes: number;
  /** First day considered, as YYYY-MM-DD. */
  readonly startDate: string;
  /** How far ahead to look before giving up. */
  readonly maxDays: number;
  /** Minimum gap between two matches for the same entrant. */
  readonly minRestMinutes: number;
}

export const DEFAULT_SCHEDULING: Omit<SchedulingConfig, 'startDate'> = {
  courtCount: 2,
  windows: [],
  matchMinutes: 60,
  maxDays: 60,
  // A player finishing a three-setter needs more than a changeover before
  // walking onto the next court.
  minRestMinutes: 60,
};

export interface SchedulableMatch {
  readonly id: string;
  readonly eventId: string;
  readonly roundIndex: number;
  /** Total rounds in this event, for the balance rule. */
  readonly roundsInEvent: number;
  /** Byes consume no court time. */
  readonly isBye: boolean;
  /**
   * Everyone who COULD play in this match: the known entrants for a round-one
   * or round-robin match, or every entrant in the feeding subtree for a later
   * bracket round. Used for conflict detection, because a player cannot be
   * booked onto two courts at once even when we do not yet know which match
   * they will reach.
   */
  readonly potentialEntrantIds: readonly string[];
  /** Match ids that must finish before this one can start. */
  readonly dependsOn: readonly string[];
}

export interface Slot {
  readonly courtIndex: number;
  /** Epoch milliseconds, UTC. */
  readonly startsAt: number;
  readonly endsAt: number;
}

export interface ScheduledMatch {
  readonly matchId: string;
  readonly eventId: string;
  readonly courtIndex: number;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface ScheduleResult {
  readonly scheduled: readonly ScheduledMatch[];
  /** Matches that did not fit in maxDays. */
  readonly unscheduled: readonly string[];
  readonly slotsAvailable: number;
  readonly slotsUsed: number;
  /** YYYY-MM-DD of the last day used. */
  readonly lastDay: string | null;
  /** Event id → YYYY-MM-DD its final is scheduled on. */
  readonly finalDayByEvent: ReadonlyMap<string, string>;
  /**
   * How many days separate the earliest and latest final. The balance rule
   * exists to keep this small; it is reported so an organizer can see whether
   * it worked rather than taking it on faith.
   */
  readonly finalSpreadDays: number;
  readonly warnings: readonly string[];
  readonly description: string;
}

const MINUTES = 60_000;
const DAY_MS = 86_400_000;

function dayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function parseDay(date: string): number {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    throw engineError('INVALID_SCHEDULE', `startDate must be YYYY-MM-DD, got "${date}"`, { date });
  }
  return parsed;
}

export function validateSchedulingConfig(config: SchedulingConfig): void {
  const fail = (message: string): never => {
    throw engineError('INVALID_SCHEDULE', message, {});
  };

  if (!Number.isInteger(config.courtCount) || config.courtCount < 1) {
    fail('courtCount must be a positive integer');
  }
  if (!Number.isInteger(config.matchMinutes) || config.matchMinutes < 1) {
    fail('matchMinutes must be a positive integer');
  }
  if (!Number.isInteger(config.maxDays) || config.maxDays < 1) {
    fail('maxDays must be a positive integer');
  }
  if (config.minRestMinutes < 0) fail('minRestMinutes cannot be negative');
  if (config.windows.length === 0) {
    fail('At least one availability window is required');
  }

  for (const w of config.windows) {
    if (!Number.isInteger(w.dayOfWeek) || w.dayOfWeek < 0 || w.dayOfWeek > 6) {
      fail(`dayOfWeek must be 0-6, got ${w.dayOfWeek}`);
    }
    if (w.startMinutes < 0 || w.endMinutes > 24 * 60) {
      fail('A window must fall inside a single day');
    }
    if (w.endMinutes <= w.startMinutes) {
      // A window that ends before it starts is almost always a typo for an
      // overnight session, which a club does not run.
      fail(`A window must end after it starts (${w.startMinutes}–${w.endMinutes})`);
    }
  }
}

/**
 * Every playable slot, in time order then court order.
 *
 * A window shorter than one match yields no slots rather than a truncated
 * one: half a match is not a booking.
 */
export function generateSlots(config: SchedulingConfig): Slot[] {
  validateSchedulingConfig(config);

  const start = parseDay(config.startDate);
  const slotMs = config.matchMinutes * MINUTES;
  const byDay = new Map<number, TimeWindow[]>();
  for (const w of config.windows) {
    const list = byDay.get(w.dayOfWeek) ?? [];
    list.push(w);
    byDay.set(w.dayOfWeek, list);
  }

  const slots: Slot[] = [];
  for (let day = 0; day < config.maxDays; day++) {
    const dayStart = start + day * DAY_MS;
    const weekday = new Date(dayStart).getUTCDay();
    const windows = [...(byDay.get(weekday) ?? [])].sort(
      (a, b) => a.startMinutes - b.startMinutes,
    );

    for (const w of windows) {
      const windowStart = dayStart + w.startMinutes * MINUTES;
      const windowEnd = dayStart + w.endMinutes * MINUTES;
      for (let t = windowStart; t + slotMs <= windowEnd; t += slotMs) {
        for (let court = 0; court < config.courtCount; court++) {
          slots.push({ courtIndex: court, startsAt: t, endsAt: t + slotMs });
        }
      }
    }
  }

  slots.sort((a, b) => a.startsAt - b.startsAt || a.courtIndex - b.courtIndex);
  return slots;
}

/** Slots per week, for capacity warnings before anything is scheduled. */
export function weeklyCapacity(config: SchedulingConfig): number {
  const slotMs = config.matchMinutes * MINUTES;
  let perWeek = 0;
  for (const w of config.windows) {
    const windowMs = (w.endMinutes - w.startMinutes) * MINUTES;
    perWeek += Math.floor(windowMs / slotMs) * config.courtCount;
  }
  return perWeek;
}

interface Placement {
  readonly entrantIds: readonly string[];
  readonly startsAt: number;
  readonly endsAt: number;
}

export function scheduleMatches(
  matches: readonly SchedulableMatch[],
  config: SchedulingConfig,
): ScheduleResult {
  const slots = generateSlots(config);
  const warnings: string[] = [];

  // Byes are not played, so they occupy no court and block nothing.
  const playable = matches.filter((m) => !m.isBye);

  const byId = new Map(playable.map((m) => [m.id, m]));
  const scheduledById = new Map<string, ScheduledMatch & { startsAtMs: number; endsAtMs: number }>();
  const placements: Placement[] = [];

  // A dependency on a bye is already satisfied: nobody has to play it.
  const effectiveDeps = new Map<string, string[]>(
    playable.map((m) => [m.id, m.dependsOn.filter((d) => byId.has(d))]),
  );

  if (playable.length > slots.length) {
    warnings.push(
      `${playable.length} matches need court time but only ${slots.length} slots exist in ${config.maxDays} days.`,
    );
  }

  const remaining = new Set(playable.map((m) => m.id));

  /**
   * The balance rule. Lower fraction first, so a long draw's early rounds
   * outrank a short draw's early rounds and every event converges on its
   * final at the same time.
   */
  const targetFraction = (m: SchedulableMatch): number =>
    m.roundsInEvent <= 0 ? 1 : (m.roundIndex + 1) / m.roundsInEvent;

  const conflicts = (m: SchedulableMatch, slot: Slot): boolean => {
    for (const p of placements) {
      // Same court time, or inside the rest window either side of it.
      const restMs = config.minRestMinutes * MINUTES;
      const overlaps = slot.startsAt < p.endsAt + restMs && p.startsAt < slot.endsAt + restMs;
      if (!overlaps) continue;
      for (const id of m.potentialEntrantIds) {
        if (p.entrantIds.includes(id)) return true;
      }
    }
    return false;
  };

  for (const slot of slots) {
    if (remaining.size === 0) break;

    let best: SchedulableMatch | undefined;
    let bestKey = Number.POSITIVE_INFINITY;

    for (const id of remaining) {
      const m = byId.get(id) as SchedulableMatch;

      // Every predecessor must be scheduled AND finished.
      let ready = true;
      for (const dep of effectiveDeps.get(id) ?? []) {
        const done = scheduledById.get(dep);
        if (done === undefined || done.endsAtMs > slot.startsAt) {
          ready = false;
          break;
        }
      }
      if (!ready) continue;
      if (conflicts(m, slot)) continue;

      const key = targetFraction(m);
      // Deterministic tie-break, so the same inputs always produce the same
      // order of play.
      if (key < bestKey || (key === bestKey && best !== undefined && m.id < best.id)) {
        best = m;
        bestKey = key;
      }
    }

    if (best === undefined) continue;

    scheduledById.set(best.id, {
      matchId: best.id,
      eventId: best.eventId,
      courtIndex: slot.courtIndex,
      startsAt: new Date(slot.startsAt).toISOString(),
      endsAt: new Date(slot.endsAt).toISOString(),
      startsAtMs: slot.startsAt,
      endsAtMs: slot.endsAt,
    });
    placements.push({
      entrantIds: best.potentialEntrantIds,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
    remaining.delete(best.id);
  }

  const scheduled = [...scheduledById.values()]
    .sort((a, b) => a.startsAtMs - b.startsAtMs || a.courtIndex - b.courtIndex)
    .map(({ startsAtMs: _s, endsAtMs: _e, ...rest }) => rest);

  // The final of an event is its highest round index.
  const finalDayByEvent = new Map<string, string>();
  const lastRoundByEvent = new Map<string, number>();
  for (const m of playable) {
    lastRoundByEvent.set(m.eventId, Math.max(lastRoundByEvent.get(m.eventId) ?? -1, m.roundIndex));
  }
  for (const m of playable) {
    if (m.roundIndex !== lastRoundByEvent.get(m.eventId)) continue;
    const placed = scheduledById.get(m.id);
    if (placed === undefined) continue;
    const day = dayKey(placed.startsAtMs);
    const existing = finalDayByEvent.get(m.eventId);
    if (existing === undefined || day > existing) finalDayByEvent.set(m.eventId, day);
  }

  const finalDays = [...finalDayByEvent.values()].sort();
  const firstFinal = finalDays[0];
  const lastFinal = finalDays.at(-1);
  const finalSpreadDays =
    firstFinal === undefined || lastFinal === undefined
      ? 0
      : Math.round((parseDay(lastFinal) - parseDay(firstFinal)) / DAY_MS);

  const lastUsed = [...scheduledById.values()].reduce(
    (max, s) => Math.max(max, s.startsAtMs),
    -1,
  );
  const lastDay = lastUsed < 0 ? null : dayKey(lastUsed);
  const unscheduled = [...remaining];

  if (unscheduled.length > 0) {
    warnings.push(
      `${unscheduled.length} ${unscheduled.length === 1 ? 'match' : 'matches'} could not be placed within ${config.maxDays} days.`,
    );
  }
  if (finalSpreadDays > 2) {
    warnings.push(
      `Finals are spread across ${finalSpreadDays} days. Add courts or hours to tighten this.`,
    );
  }

  const days =
    lastDay === null ? 0 : Math.round((parseDay(lastDay) - parseDay(config.startDate)) / DAY_MS) + 1;

  return {
    scheduled,
    unscheduled,
    slotsAvailable: slots.length,
    slotsUsed: scheduled.length,
    lastDay,
    finalDayByEvent,
    finalSpreadDays,
    warnings,
    description:
      `${scheduled.length} of ${playable.length} matches across ${config.courtCount} ` +
      `${config.courtCount === 1 ? 'court' : 'courts'} over ${days} ${days === 1 ? 'day' : 'days'}` +
      (finalDays.length > 1
        ? `; all finals within ${finalSpreadDays} ${finalSpreadDays === 1 ? 'day' : 'days'} of each other.`
        : '.'),
  };
}
