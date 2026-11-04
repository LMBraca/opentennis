/**
 * DB-4 GUARDRAIL: globally unique, human-readable tournament slugs.
 *
 * Public URLs are /t/:slug. If slugs were unique only per organization, then
 * adding a second organization would force /:org/t/:slug or a subdomain — and
 * every printed QR code already taped to a clubhouse wall would break. The
 * spec promises printed codes keep working for the life of the tournament
 * (PRD §4.4, §9.1), so the uniqueness is global from the first migration.
 *
 * The cost is one unique index and an occasional "that name is taken" during
 * tournament creation. In exchange /t/:slug never has to change.
 */

/** Longer than this and nobody will read it off a poster. */
export const MAX_SLUG_LENGTH = 48;

/**
 * Category codes need a stable, predictable slug. `C+` becomes `c-plus`
 * rather than `c` — otherwise `C` and `C+` would collide, which is the one
 * collision the ladder absolutely cannot tolerate.
 */
export function slugifyCategoryCode(code: string): string {
  return slugify(code.replace(/\+/g, '-plus').replace(/#/g, '-sharp'));
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Strip combining marks so "Ñ" becomes "N" rather than vanishing.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * Slug for a tournament, shortened for speaking aloud. A four-digit year is
 * reduced to two: "autumn-open-26" beats "autumn-open-2026" on a poster, and
 * the year is there to disambiguate seasons rather than to be precise.
 */
export function tournamentSlug(name: string, year?: number): string {
  const base = slugify(name);
  if (year === undefined) return base;

  const short = String(year % 100).padStart(2, '0');
  // Do not append a year the name already carries.
  if (new RegExp(`(^|-)(${year}|${short})(-|$)`).test(base)) return base;

  return slugify(`${base}-${short}`);
}

/**
 * Resolve a collision by suffixing. Tries the bare slug first, then a
 * discriminator the organizer supplied (their club name, typically), then
 * numbers — because "autumn-open-26-riverside" is far more use to someone
 * reading it than "autumn-open-26-2".
 */
export function nextAvailableSlug(
  desired: string,
  isTaken: (slug: string) => boolean,
  discriminator?: string,
): string {
  const base = slugify(desired);
  if (!isTaken(base)) return base;

  if (discriminator !== undefined && discriminator.trim() !== '') {
    const withDiscriminator = slugify(`${base}-${discriminator}`);
    if (!isTaken(withDiscriminator)) return withDiscriminator;
  }

  for (let n = 2; n < 1000; n++) {
    const candidate = slugify(`${base}-${n}`);
    if (!isTaken(candidate)) return candidate;
  }

  throw new Error(`Could not find an available slug based on "${base}"`);
}

/**
 * Reserved path segments. A tournament slugged "api" or "admin" would shadow a
 * real route, and the failure would look like a routing bug rather than a
 * naming one.
 */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'dashboard',
  'enter',
  'favicon',
  'health',
  'login',
  'logout',
  'media',
  'new',
  'public',
  'robots',
  'settings',
  'sitemap',
  'static',
  't',
  'updates',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function isValidSlug(slug: string): boolean {
  return (
    slug.length > 0 &&
    slug.length <= MAX_SLUG_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    !isReservedSlug(slug)
  );
}
