/**
 * Prose helpers for generated descriptions.
 *
 * These strings land verbatim in the admin draw preview, so they have to read
 * like someone wrote them. "a 8 bracket" is the kind of detail that makes a
 * product feel unfinished.
 */

/**
 * "a" or "an" for a number read aloud: an 8, an 11, an 18, an 8000, an 1800.
 * Everything else takes "a" — including 1 ("a 1"), since the numeral is read
 * as "one" rather than "eighteen".
 */
export function article(n: number): string {
  const s = String(Math.abs(Math.trunc(n)));
  if (s.startsWith('8')) return 'an';
  // 11 and 18 read as "eleven"/"eighteen" only at a thousands boundary:
  //   11 -> eleven            (len 2)  an
  //   110 -> one hundred ten  (len 3)  a
  //   11000 -> eleven thousand (len 5) an
  // which is exactly length % 3 === 2.
  if ((s.startsWith('11') || s.startsWith('18')) && s.length % 3 === 2) return 'an';
  return 'a';
}

/** "1 match" / "2 matches" */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
