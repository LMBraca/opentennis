/**
 * The venue's clock.
 *
 * The scheduling engine is deliberately timezone-free: it lays matches out as
 * minutes from midnight on an abstract day (`getUTCDay()`, minutes arithmetic)
 * and hands back instants whose UTC fields carry the intended WALL-CLOCK
 * time. A 10:00 court window comes back as 10:00Z.
 *
 * Stored like that, `scheduledAt` is not a real instant — it is eight hours
 * out, and an order of play rendered in the venue's own zone put the first
 * match of the day at 02:00. This module is the single boundary where the
 * engine's abstract wall clock becomes a real moment in time, so the column
 * can mean what its `timestamptz` type claims.
 *
 * The zone is IANA, not a fixed -8. Tijuana is Pacific and observes DST, so a
 * hardcoded offset would be right in November and an hour wrong in July — the
 * kind of bug that surfaces as "the whole draw is an hour late" halfway
 * through a summer tournament.
 */

/** One club, one venue. A per-tournament zone belongs here when there are two. */
export const VENUE_TIME_ZONE = 'America/Tijuana';

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: VENUE_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** What `instant` reads as on the venue's wall, expressed in UTC fields. */
function wallFieldsOf(instant: number): number {
  const parts: Record<string, string> = {};
  for (const part of PARTS.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return Date.UTC(
    Number(parts['year']),
    Number(parts['month']) - 1,
    Number(parts['day']),
    // Intl can render midnight as "24" in some locales/engines.
    Number(parts['hour']) % 24,
    Number(parts['minute']),
    Number(parts['second']),
  );
}

/**
 * Turn an engine wall-clock into the real instant it means.
 *
 * `wallClock` carries the intended local time in its UTC fields — 10:00 on
 * the venue's wall arrives here as 10:00Z. The returned Date is the actual
 * moment that wall time occurs in the venue's zone (18:00Z in winter).
 *
 * Corrected twice: the first pass uses the offset in force at the guessed
 * instant, which is the wrong side of a DST change for times within an hour
 * of the switch. The second pass re-reads the offset at the corrected
 * instant and settles it.
 */
export function wallClockToInstant(wallClock: Date): Date {
  const target = wallClock.getTime();
  let guess = target;
  for (let pass = 0; pass < 2; pass += 1) {
    const drift = target - wallFieldsOf(guess);
    if (drift === 0) break;
    guess += drift;
  }
  return new Date(guess);
}

/** The inverse, for reading a stored instant back as the engine's wall clock. */
export function instantToWallClock(instant: Date): Date {
  return new Date(wallFieldsOf(instant.getTime()));
}

export function venueDateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: VENUE_TIME_ZONE,
  });
}

export function venueTimeFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VENUE_TIME_ZONE,
  });
}

export function venueTimestampFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VENUE_TIME_ZONE,
    timeZoneName: 'short',
  });
}

export function venueArticleDateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: VENUE_TIME_ZONE,
  });
}

export function tournamentCalendarDateFormatter(
  locale: string,
  options: Omit<Intl.DateTimeFormatOptions, 'timeZone'>,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
}

/**
 * "5–7 de noviembre de 2026", or a single day when there is only one.
 *
 * `formatRange` rather than two formatted dates joined by a dash: Intl
 * collapses the shared parts per locale, which is the difference between
 * "5–7 de noviembre de 2026" and "5 de noviembre de 2026 – 7 de noviembre
 * de 2026". Extracted here because the home page and the OT-17 overview
 * both need it and a second copy is a second answer.
 *
 * `T00:00:00Z` and `timeZone: 'UTC'` are both required: these are plain
 * calendar dates stored as text, and Tijuana is eight hours west of
 * Greenwich, so local parsing prints the day before.
 */
export function tournamentDateRange(
  start: string | null,
  end: string | null,
  locale: string,
): string | null {
  if (start === null) return null;
  const parse = (value: string): Date => new Date(`${value}T00:00:00Z`);
  return tournamentCalendarDateFormatter(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatRange(parse(start), parse(end ?? start));
}
