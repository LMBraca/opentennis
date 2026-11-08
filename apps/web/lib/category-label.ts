/**
 * OT-21 — how long a category name may be, in one place.
 *
 * "QA Test Category" became "QA Test Cate" and nothing said why. The cap
 * was a bare `.slice(0, 12)` in two actions, with no counter, no helper and
 * no error — the organizer typed a name, pressed Save, and got a different
 * name back. Silent truncation of something a person just typed is the
 * worst of the three options: rejecting it explains itself, and accepting
 * it is fine, but quietly changing it looks like data loss.
 *
 * The column is `text`, so 12 was never a storage limit — it was a guess
 * about display. 40 is the new one, and it lives here so the input's
 * `maxLength`, the counter under it and the server's refusal cannot
 * disagree. Same reasoning as `lib/entry-validation.ts`.
 *
 * The SLUG is unaffected and must stay that way: `/t/:slug/:category/…`
 * is printed on QR codes (PRD §4.4), so renaming a label must never
 * change a URL. `renameCategory` already only writes `code`.
 */

export const CATEGORY_LABEL_MAX = 40;

export type CategoryLabelProblem = 'empty' | 'tooLong' | 'noAlphanumeric';

/**
 * Why this name cannot be used, or null if it can.
 *
 * Deliberately does NOT trim-and-accept an over-long name: the caller
 * wants to tell the organizer, not fix it behind their back.
 */
export function categoryLabelProblem(raw: string): CategoryLabelProblem | null {
  const value = raw.trim();
  if (value === '') return 'empty';
  // Counted on the trimmed value, so trailing spaces never cost a
  // character the organizer cannot see.
  if ([...value].length > CATEGORY_LABEL_MAX) return 'tooLong';
  // The slug is derived from this, and a name with nothing URL-safe in it
  // produces an empty slug.
  if (slugifyCategory(value) === '') return 'noAlphanumeric';
  return null;
}

/**
 * "C+" -> "c-plus". Lifted out of the actions so the validator and the
 * writer agree on what an unusable name is.
 */
export function slugifyCategory(code: string): string {
  return code
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Characters used, by code POINT rather than UTF-16 unit.
 *
 * `'ñ'.length` is 1 but a combining mark or an emoji is 2, so a plain
 * `.length` counter would show 2/40 for one visible character and the
 * input would stop accepting text before the counter said it should.
 */
export function categoryLabelLength(raw: string): number {
  return [...raw.trim()].length;
}
