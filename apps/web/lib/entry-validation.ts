/**
 * OT-18 — what a valid entry looks like, as a pure function.
 *
 * Every required field on the entry form carried `required`, so the BROWSER
 * refused an empty submit and said "Please select an item in the list." — in
 * the browser's language, which is nobody's guarantee, on the most-reached
 * page of a Spanish-first site. The form has to validate itself to say
 * anything in the reader's language, and once it does, its rules have to
 * agree with the server's.
 *
 * So the rules live here rather than in the component: the same module is
 * the form's check and the shape the action enforces. A form that accepts
 * what the server rejects is the bug this arrangement prevents, and it is
 * the same reasoning as `resolveScoringFormat`.
 *
 * Returns dictionary KEYS, not sentences. This is pure and has no locale.
 */

/** In DOM order. "Focus the first invalid field" means first in THIS list. */
export const ENTRY_FIELDS = [
  'eventId',
  'fullName',
  'partnerName',
  'email',
  'phone',
] as const;

export type EntryField = (typeof ENTRY_FIELDS)[number];

/**
 * Deliberately permissive: one @, one dot after it, no spaces.
 *
 * The server uses this exact shape. Anything stricter starts rejecting
 * addresses that work — and the club cannot afford to turn away an entry
 * over a hostname it has not heard of.
 */
export const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface EntryValues {
  readonly eventId: string;
  readonly fullName: string;
  readonly partnerName: string;
  readonly email: string;
  readonly phone: string;
}

/** The dictionary keys this module can ask for. */
export type EntryErrorKey =
  | 'entryNeedDraw'
  | 'entryNeedName'
  | 'entryNeedPartner'
  | 'entryNeedEmail'
  | 'entryNeedPhone';

export type EntryFieldErrors = Readonly<Partial<Record<EntryField, EntryErrorKey>>>;

/**
 * Which fields are wrong, and why.
 *
 * `isDoubles` rather than reading the discipline off the selection: the
 * caller already resolved which draw was chosen, and this stays free of the
 * draw list.
 */
export function validateEntry(values: EntryValues, isDoubles: boolean): EntryFieldErrors {
  const errors: { -readonly [K in EntryField]?: EntryErrorKey } = {};

  if (values.eventId.trim() === '') errors.eventId = 'entryNeedDraw';
  // Trimmed, so a field holding only spaces is empty. No pattern on the
  // SHAPE of a name — hyphens, apostrophes, accents and one-letter parts
  // are all real, and rejecting them insults the person typing.
  if (values.fullName.trim() === '') errors.fullName = 'entryNeedName';
  if (isDoubles && values.partnerName.trim() === '') errors.partnerName = 'entryNeedPartner';
  if (!EMAIL_SHAPE.test(values.email.trim())) errors.email = 'entryNeedEmail';
  if (values.phone.trim() === '') errors.phone = 'entryNeedPhone';

  return errors;
}

/** The first wrong field in DOM order, which is the one to focus. */
export function firstInvalidField(errors: EntryFieldErrors): EntryField | null {
  return ENTRY_FIELDS.find((field) => errors[field] !== undefined) ?? null;
}

export function errorCount(errors: EntryFieldErrors): number {
  return ENTRY_FIELDS.filter((field) => errors[field] !== undefined).length;
}
