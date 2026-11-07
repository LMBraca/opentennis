import { describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import {
  generateSlots,
  scheduleMatches,
  validateSchedulingConfig,
  weeklyCapacity,
  type SchedulableMatch,
  type SchedulingConfig,
  type TimeWindow,
} from './scheduling';
import { generateRoundRobin } from './round-robin';
import { unseeded } from './testing/fixtures';

/** The club's real availability: 2 courts, early + evening weekdays, midday weekends. */
const WEEKDAY_EARLY = (d: number): TimeWindow => ({ dayOfWeek: d, startMinutes: 6 * 60, endMinutes: 8 * 60 });
const WEEKDAY_EVENING = (d: number): TimeWindow => ({ dayOfWeek: d, startMinutes: 18 * 60, endMinutes: 22 * 60 });
const WEEKEND = (d: number): TimeWindow => ({ dayOfWeek: d, startMinutes: 10 * 60, endMinutes: 16 * 60 });

const CLUB_WINDOWS: TimeWindow[] = [
  ...[1, 2, 3, 4, 5].flatMap((d) => [WEEKDAY_EARLY(d), WEEKDAY_EVENING(d)]),
  WEEKEND(0),
  WEEKEND(6),
];

function config(overrides: Partial<SchedulingConfig> = {}): SchedulingConfig {
  return {
    courtCount: 2,
    windows: CLUB_WINDOWS,
    matchMinutes: 60,
    // 2026-11-16 is a Monday.
    startDate: '2026-11-16',
    maxDays: 60,
    minRestMinutes: 60,
    ...overrides,
  };
}

/** A single-elimination event as the scheduler sees it. */
function bracket(eventId: string, entrants: number): SchedulableMatch[] {
  let size = 1;
  while (size < entrants) size *= 2;
  const rounds = Math.log2(size);
  const out: SchedulableMatch[] = [];
  const idsIn = (round: number, slot: number): string[] => {
    const span = size / 2 ** (round + 1);
    const first = slot * span * 2;
    return Array.from({ length: span * 2 }, (_, i) => `${eventId}-p${first + i}`).filter(
      (_, i) => first + i < entrants,
    );
  };

  for (let round = 0; round < rounds; round++) {
    const count = size / 2 ** (round + 1);
    for (let slot = 0; slot < count; slot++) {
      out.push({
        id: `${eventId}-r${round}m${slot}`,
        eventId,
        roundIndex: round,
        roundsInEvent: rounds,
        isBye: false,
        potentialEntrantIds: idsIn(round, slot),
        dependsOn:
          round === 0
            ? []
            : [`${eventId}-r${round - 1}m${slot * 2}`, `${eventId}-r${round - 1}m${slot * 2 + 1}`],
      });
    }
  }
  return out;
}

describe('validateSchedulingConfig', () => {
  it('accepts the club configuration', () => {
    expect(() => validateSchedulingConfig(config())).not.toThrow();
  });

  it('requires at least one window', () => {
    expect(() => validateSchedulingConfig(config({ windows: [] }))).toThrow(/at least one/i);
  });

  it('rejects a window that ends before it starts', () => {
    // Almost always a typo for an overnight session, which a club does not run.
    expect(() =>
      validateSchedulingConfig(
        config({ windows: [{ dayOfWeek: 1, startMinutes: 1200, endMinutes: 300 }] }),
      ),
    ).toThrow(/end after it starts/);
  });

  it('rejects a dayOfWeek outside 0-6', () => {
    expect(() =>
      validateSchedulingConfig(config({ windows: [{ dayOfWeek: 7, startMinutes: 0, endMinutes: 60 }] })),
    ).toThrow(/0-6/);
  });

  it('rejects zero courts', () => {
    expect(() => validateSchedulingConfig(config({ courtCount: 0 }))).toThrow(EngineError);
  });
});

describe('generateSlots', () => {
  it('produces courtCount slots per hour of every window', () => {
    // Monday only: 6-8am is 2 hours, 6-10pm is 4 hours. 6 hours x 2 courts.
    const slots = generateSlots(
      config({ windows: [WEEKDAY_EARLY(1), WEEKDAY_EVENING(1)], maxDays: 1 }),
    );
    expect(slots).toHaveLength(12);
  });

  it('starts the first slot at the window opening', () => {
    const slots = generateSlots(config({ windows: [WEEKDAY_EARLY(1)], maxDays: 1 }));
    expect(new Date(slots[0]!.startsAt).toISOString()).toBe('2026-11-16T06:00:00.000Z');
  });

  it('never runs a slot past the end of its window', () => {
    for (const s of generateSlots(config({ maxDays: 14 }))) {
      const minutes = new Date(s.endsAt).getUTCHours() * 60 + new Date(s.endsAt).getUTCMinutes();
      const open = CLUB_WINDOWS.some(
        (w) => w.dayOfWeek === new Date(s.startsAt).getUTCDay() && minutes <= w.endMinutes,
      );
      expect(open).toBe(true);
    }
  });

  it('drops a window too short for one match rather than truncating it', () => {
    // Half a match is not a booking.
    const slots = generateSlots(
      config({ windows: [{ dayOfWeek: 1, startMinutes: 600, endMinutes: 630 }], maxDays: 1 }),
    );
    expect(slots).toEqual([]);
  });

  it('is ordered by time, then court', () => {
    const slots = generateSlots(config({ maxDays: 7 }));
    for (let i = 1; i < slots.length; i++) {
      const a = slots[i - 1]!;
      const b = slots[i]!;
      expect(a.startsAt < b.startsAt || (a.startsAt === b.startsAt && a.courtIndex < b.courtIndex)).toBe(true);
    }
  });

  it('skips days with no window', () => {
    const onlySunday = generateSlots(config({ windows: [WEEKEND(0)], maxDays: 7 }));
    for (const s of onlySunday) expect(new Date(s.startsAt).getUTCDay()).toBe(0);
  });
});

describe('weeklyCapacity', () => {
  it('counts the club at 84 matches a week on two courts', () => {
    // Weekdays 6h x 5 = 30, weekends 6h x 2 = 12, so 42 hours x 2 courts.
    expect(weeklyCapacity(config())).toBe(84);
  });

  it('scales with courts', () => {
    expect(weeklyCapacity(config({ courtCount: 4 }))).toBe(168);
  });
});

describe('scheduleMatches', () => {
  it('schedules a small bracket and reports it', () => {
    const result = scheduleMatches(bracket('e1', 8), config());
    expect(result.unscheduled).toEqual([]);
    expect(result.slotsUsed).toBe(7);
    expect(result.description).toMatch(/7 of 7 matches across 2 courts/);
  });

  it('never starts a match before both feeders have finished', () => {
    const matches = bracket('e1', 16);
    const result = scheduleMatches(matches, config());
    const byId = new Map(result.scheduled.map((s) => [s.matchId, s]));

    for (const m of matches) {
      const placed = byId.get(m.id);
      if (placed === undefined) continue;
      for (const dep of m.dependsOn) {
        const feeder = byId.get(dep);
        expect(feeder, `${m.id} depends on unscheduled ${dep}`).toBeDefined();
        expect(Date.parse(feeder!.endsAt)).toBeLessThanOrEqual(Date.parse(placed.startsAt));
      }
    }
  });

  it('never books one court for two matches at once', () => {
    const result = scheduleMatches(
      [...bracket('a', 8), ...bracket('b', 8), ...bracket('c', 8)],
      config(),
    );
    const seen = new Set<string>();
    for (const s of result.scheduled) {
      const key = `${s.courtIndex}@${s.startsAt}`;
      expect(seen.has(key), `double booking ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('never books one entrant onto two courts at once', () => {
    const matches = [...bracket('a', 8), ...bracket('b', 8)];
    const byId = new Map(matches.map((m) => [m.id, m]));
    const result = scheduleMatches(matches, config());

    const byStart = new Map<string, string[]>();
    for (const s of result.scheduled) {
      const list = byStart.get(s.startsAt) ?? [];
      list.push(s.matchId);
      byStart.set(s.startsAt, list);
    }
    for (const [start, ids] of byStart) {
      const all = ids.flatMap((id) => byId.get(id)!.potentialEntrantIds);
      expect(new Set(all).size, `clash at ${start}`).toBe(all.length);
    }
  });

  it('honours the rest window between an entrant\'s matches', () => {
    const matches = bracket('e1', 8);
    const byId = new Map(matches.map((m) => [m.id, m]));
    const minRestMinutes = 120;
    const result = scheduleMatches(matches, config({ minRestMinutes }));

    for (const a of result.scheduled) {
      for (const b of result.scheduled) {
        if (a.matchId >= b.matchId) continue;
        const shared = byId
          .get(a.matchId)!
          .potentialEntrantIds.some((id) => byId.get(b.matchId)!.potentialEntrantIds.includes(id));
        if (!shared) continue;
        const [earlier, later] = Date.parse(a.startsAt) < Date.parse(b.startsAt) ? [a, b] : [b, a];
        const gap = Date.parse(later.startsAt) - Date.parse(earlier.endsAt);
        expect(gap).toBeGreaterThanOrEqual(minRestMinutes * 60 * 1000);
      }
    }
  });

  it('lists every match in a six-player round robin exactly once and enforces player rest', () => {
    const stage = generateRoundRobin({ entrants: unseeded(6), randomSeed: 'qa-flow-test-26' });
    const generated = stage.rounds.flatMap((round) =>
      round.matches.map((match) => ({
        id: match.id,
        eventId: 'qa-flow-test-26',
        roundIndex: round.index,
        roundsInEvent: stage.rounds.length,
        isBye: false,
        potentialEntrantIds: match.sides.flatMap((side) =>
          side.entrantId === null ? [] : [side.entrantId],
        ),
        dependsOn: [],
      })),
    );
    const result = scheduleMatches(generated, {
      courtCount: 2,
      windows: [WEEKEND(0), WEEKEND(6)],
      matchMinutes: 60,
      startDate: '2026-11-15',
      maxDays: 7,
      minRestMinutes: 60,
    });

    expect(generated).toHaveLength(15);
    expect(result.unscheduled).toEqual([]);
    expect(result.scheduled).toHaveLength(15);
    expect(new Set(result.scheduled.map((match) => match.matchId)).size).toBe(15);
    expect(result.scheduled.map((match) => match.matchId).sort()).toEqual(
      generated.map((match) => match.id).sort(),
    );

    for (let i = 0; i < result.scheduled.length; i += 1) {
      const current = result.scheduled[i]!;
      const currentMatch = generated.find((match) => match.id === current.matchId)!;
      const currentStart = Date.parse(current.startsAt);
      const currentEnd = Date.parse(current.endsAt);
      const day = new Date(current.startsAt).getUTCDay();
      const startMinute =
        new Date(current.startsAt).getUTCHours() * 60 + new Date(current.startsAt).getUTCMinutes();
      expect([0, 6]).toContain(day);
      expect(startMinute).toBeGreaterThanOrEqual(600);
      expect(startMinute + 60).toBeLessThanOrEqual(960);
      for (const next of result.scheduled.slice(i + 1)) {
        const nextMatch = generated.find((match) => match.id === next.matchId)!;
        const sharedPlayer = currentMatch.potentialEntrantIds.some((id) =>
          nextMatch.potentialEntrantIds.includes(id),
        );
        if (!sharedPlayer) continue;
        const nextStart = Date.parse(next.startsAt);
        const nextEnd = Date.parse(next.endsAt);
        const [earlierEnd, laterStart] =
          currentStart < nextStart ? [currentEnd, nextStart] : [nextEnd, currentStart];
        expect(laterStart - earlierEnd).toBeGreaterThanOrEqual(60 * 60 * 1000);
      }
    }
  });

  it('skips byes, which consume no court', () => {
    const matches: SchedulableMatch[] = [
      { id: 'bye', eventId: 'e', roundIndex: 0, roundsInEvent: 2, isBye: true, potentialEntrantIds: ['p1'], dependsOn: [] },
      { id: 'real', eventId: 'e', roundIndex: 0, roundsInEvent: 2, isBye: false, potentialEntrantIds: ['p2', 'p3'], dependsOn: [] },
      { id: 'final', eventId: 'e', roundIndex: 1, roundsInEvent: 2, isBye: false, potentialEntrantIds: ['p1', 'p2', 'p3'], dependsOn: ['bye', 'real'] },
    ];
    const result = scheduleMatches(matches, config());
    expect(result.scheduled.map((s) => s.matchId).sort()).toEqual(['final', 'real']);
    // A dependency on a bye is already satisfied, so the final is not blocked.
    expect(result.unscheduled).toEqual([]);
  });

  describe('the balance rule', () => {
    it('finishes a long draw and a short draw within a day of each other', () => {
      // 32-draw is 5 rounds; 4-draw is 2. Sorting by round index would run
      // every round 1 first and leave the short event done days early.
      const result = scheduleMatches([...bracket('big', 32), ...bracket('small', 4)], config());
      expect(result.unscheduled).toEqual([]);
      expect(result.finalSpreadDays).toBeLessThanOrEqual(1);
    });

    it('starts the longer draw before the shorter one', () => {
      const result = scheduleMatches([...bracket('big', 32), ...bracket('small', 4)], config());
      const firstBig = result.scheduled.find((s) => s.eventId === 'big');
      const firstSmall = result.scheduled.find((s) => s.eventId === 'small');
      expect(Date.parse(firstBig!.startsAt)).toBeLessThanOrEqual(Date.parse(firstSmall!.startsAt));
    });

    it('keeps every final close across a realistic eight-draw grid', () => {
      const grid = [
        ...bracket('open-s', 6),
        ...bracket('open-d', 4),
        ...bracket('a-s', 8),
        ...bracket('b-s', 5),
        ...bracket('cplus-s', 12),
        ...bracket('cplus-d', 8),
        ...bracket('c-s', 24),
        ...bracket('d-s', 17),
      ];
      const result = scheduleMatches(grid, config());
      expect(result.unscheduled).toEqual([]);
      expect(result.finalSpreadDays).toBeLessThanOrEqual(2);
      expect(result.finalDayByEvent.size).toBe(8);
    });
  });

  describe('capacity', () => {
    it('warns rather than silently dropping matches when there is no room', () => {
      const result = scheduleMatches(bracket('e1', 64), config({ maxDays: 1 }));
      expect(result.unscheduled.length).toBeGreaterThan(0);
      expect(result.warnings.join(' ')).toMatch(/could not be placed/);
    });

    it('reports the slot budget it was working with', () => {
      const result = scheduleMatches(bracket('e1', 8), config({ maxDays: 1 }));
      expect(result.slotsAvailable).toBe(12);
    });

    it('fits more per day with more courts', () => {
      const matches = bracket('e1', 32);
      const two = scheduleMatches(matches, config({ courtCount: 2 }));
      const six = scheduleMatches(matches, config({ courtCount: 6 }));
      expect(Date.parse(six.lastDay!)).toBeLessThanOrEqual(Date.parse(two.lastDay!));
    });
  });

  it('is deterministic', () => {
    const matches = [...bracket('a', 16), ...bracket('b', 8)];
    expect(JSON.stringify(scheduleMatches(matches, config()).scheduled)).toBe(
      JSON.stringify(scheduleMatches(matches, config()).scheduled),
    );
  });

  it('handles an empty field', () => {
    const result = scheduleMatches([], config());
    expect(result.scheduled).toEqual([]);
    expect(result.lastDay).toBeNull();
    expect(result.finalSpreadDays).toBe(0);
  });

  it('only uses hours the club is open', () => {
    const result = scheduleMatches([...bracket('a', 16), ...bracket('b', 16)], config());
    for (const s of result.scheduled) {
      const d = new Date(s.startsAt);
      const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      const inWindow = CLUB_WINDOWS.some(
        (w) => w.dayOfWeek === d.getUTCDay() && minutes >= w.startMinutes && minutes < w.endMinutes,
      );
      expect(inWindow, `${s.startsAt} is outside opening hours`).toBe(true);
    }
  });
});
