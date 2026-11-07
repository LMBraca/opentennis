import { describe, expect, it } from 'vitest';
import {
  instantToWallClock,
  tournamentCalendarDateFormatter,
  venueArticleDateFormatter,
  venueTimestampFormatter,
  venueTimeFormatter,
  VENUE_TIME_ZONE,
  wallClockToInstant,
} from './venue-time';

/** The engine hands back wall-clock time in UTC fields. */
const wall = (iso: string): Date => new Date(iso);

describe('wallClockToInstant', () => {
  it('reads 10:00 in November as 18:00Z — Pacific standard time, UTC-8', () => {
    expect(wallClockToInstant(wall('2026-11-14T10:00:00.000Z')).toISOString()).toBe(
      '2026-11-14T18:00:00.000Z',
    );
  });

  it('reads 10:00 in July as 17:00Z — daylight time, UTC-7', () => {
    // The reason this is an IANA zone and not a hardcoded -8: the same wall
    // clock is a different instant in summer.
    expect(wallClockToInstant(wall('2026-07-14T10:00:00.000Z')).toISOString()).toBe(
      '2026-07-14T17:00:00.000Z',
    );
  });

  it('round-trips back to the wall clock it came from', () => {
    for (const iso of [
      '2026-01-05T08:30:00.000Z',
      '2026-06-20T19:45:00.000Z',
      '2026-11-14T10:00:00.000Z',
      '2026-12-31T23:00:00.000Z',
    ]) {
      const instant = wallClockToInstant(wall(iso));
      expect(instantToWallClock(instant).toISOString()).toBe(iso);
    }
  });

  it('formats back to the hour an organizer typed', () => {
    const instant = wallClockToInstant(wall('2026-11-14T10:00:00.000Z'));
    expect(venueTimeFormatter('es').format(instant)).toBe('10:00');
  });

  it('survives the spring-forward weekend', () => {
    // 2026-03-08 is the US/Mexico-border DST change. Times either side must
    // still come back as themselves.
    const before = wallClockToInstant(wall('2026-03-07T10:00:00.000Z'));
    const after = wallClockToInstant(wall('2026-03-09T10:00:00.000Z'));
    expect(venueTimeFormatter('es').format(before)).toBe('10:00');
    expect(venueTimeFormatter('es').format(after)).toBe('10:00');
  });

  it('keeps consecutive slots one hour apart', () => {
    const a = wallClockToInstant(wall('2026-11-14T10:00:00.000Z'));
    const b = wallClockToInstant(wall('2026-11-14T11:00:00.000Z'));
    expect(b.getTime() - a.getTime()).toBe(60 * 60 * 1000);
  });
});

describe('VENUE_TIME_ZONE', () => {
  it('is an IANA zone, not an offset', () => {
    // A fixed "-08:00" would be an hour wrong for half the year.
    expect(VENUE_TIME_ZONE).toBe('America/Tijuana');
    expect(() => new Intl.DateTimeFormat('en', { timeZone: VENUE_TIME_ZONE })).not.toThrow();
  });
});

describe('display formatters', () => {
  it('keeps an instant before UTC midnight on the previous Tijuana date', () => {
    const instant = new Date('2026-11-07T00:25:00.000Z');
    const parts = venueTimestampFormatter('es-MX').formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((item) => item.type === type)?.value ?? '';

    expect(part('day')).toBe('6');
    expect(part('hour')).toBe('16');
    expect(part('minute')).toBe('25');
    expect(part('timeZoneName')).not.toBe('');
    expect(venueArticleDateFormatter('es-MX').format(instant)).toContain('6 de noviembre de 2026');
  });

  it('formats summer instants with the venue DST offset', () => {
    const parts = venueTimestampFormatter('en-GB').formatToParts(
      new Date('2026-07-14T17:00:00.000Z'),
    );
    expect(parts.find((item) => item.type === 'hour')?.value).toBe('10');
    expect(parts.find((item) => item.type === 'timeZoneName')?.value).not.toBe('');
  });

  it('keeps date-only tournament days on the UTC calendar date', () => {
    const date = new Date('2026-11-06T00:00:00.000Z');
    expect(tournamentCalendarDateFormatter('es-MX', { day: 'numeric' }).format(date)).toBe('6');
  });
});
