'use server';

/**
 * Public registration.
 *
 * THE ONLY UNAUTHENTICATED WRITE in the product. Everything else public is
 * read-only, so this is the whole anonymous attack surface and is treated
 * accordingly: strict field validation, length caps, a honeypot, a
 * minimum time-to-submit, and a per-process rate limit.
 *
 * There is deliberately NO approval step -- an entry lands as an active
 * entrant and shows up in the admin panel immediately, where the only thing
 * an organizer does is tick whether the fee has been paid. That removes the
 * review queue, which is why the abuse guards above matter more rather than
 * less.
 */

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { verifyTurnstile } from '@/lib/turnstile';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { acceptSubmission, splitName } from '@/lib/accept-entry';
import { formatAmount, stripeEnabled } from '@/lib/stripe';

export interface EnterState {
  readonly error?: string;
  /**
   * A KEY, not a sentence. The action runs on the server and has no idea
   * which language the page is in; returning English text here is what made
   * the Spanish confirmation read "¡Listo! You are entered."
   */
  readonly ok?: 'singles' | 'doubles';
  /** Partner name, for the doubles confirmation. */
  readonly partner?: string;
  /** Set when the category has a fee and Stripe is configured. */
  readonly entrantId?: string;
  readonly feeLabel?: string;
}

const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_PHONE = 40;

/**
 * Per-process, per-IP limit. Not a substitute for a shared store across
 * instances, but it stops the obvious case and costs nothing.
 */
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function cleanName(value: string): string {
  // Only trimming and a length cap. No pattern matching on the SHAPE of a
  // name: hyphens, apostrophes, accents and single-character parts are all
  // real, and rejecting them insults the person typing.
  return value.trim().slice(0, MAX_NAME);
}

export async function submitEntry(
  _prev: EnterState,
  formData: FormData,
): Promise<EnterState> {
  const organizationId = orgId();
  const slug = String(formData.get('slug') ?? '');

  // Honeypot: a field hidden from people, irresistible to a naive bot.
  if (String(formData.get('website') ?? '') !== '') {
    // Answer a bot exactly as a person, so it learns nothing.
    return { ok: 'singles' };
  }

  // A human cannot read the form, type a name and submit in under two seconds.
  const renderedAt = Number(formData.get('renderedAt') ?? 0);
  if (Number.isFinite(renderedAt) && renderedAt > 0 && Date.now() - renderedAt < 2000) {
    return { error: 'That was too quick — please try again.' };
  }

  const head = await headers();
  const ip = head.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (rateLimited(ip)) {
    return { error: 'Too many entries from this connection. Try again in a minute.' };
  }

  /*
   * ENT-3, last of the four gates and the only one a determined script
   * cannot simply read around. Skipped entirely when the club has no
   * Cloudflare keys, and allowed through when Cloudflare itself cannot be
   * reached — see lib/turnstile.ts for why failing open is the right trade
   * in front of the page that earns the club its entries.
   */
  const challenge = await verifyTurnstile(
    typeof formData.get('cf-turnstile-response') === 'string'
      ? String(formData.get('cf-turnstile-response'))
      : null,
    ip,
  );
  if (!challenge.ok) {
    return { error: 'Please complete the “I am human” check and try again.' };
  }

  const fullName = cleanName(String(formData.get('fullName') ?? ''));
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, MAX_EMAIL);
  const phone = String(formData.get('phone') ?? '').trim().slice(0, MAX_PHONE);
  const partnerName = cleanName(String(formData.get('partnerName') ?? ''));
  const eventId = String(formData.get('eventId') ?? '');

  if (fullName === '') return { error: 'Enter your name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (phone === '') return { error: 'Enter a phone number.' };
  if (eventId === '') return { error: 'Choose which draw you are entering.' };

  const tournaments = await db()
    .select({
      id: schema.tournaments.id,
      entriesOpen: schema.tournaments.entriesOpen,
      reviewEntries: schema.tournaments.reviewEntries,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);

  const tournament = tournaments[0];
  if (tournament === undefined) return { error: 'Tournament not found.' };
  if (!tournament.entriesOpen) return { error: 'Entries are closed for this tournament.' };

  const events = await db()
    .select({
      id: schema.events.id,
      discipline: schema.events.discipline,
      status: schema.events.status,
      feeCents: schema.events.entryFeeCents,
      currency: schema.events.currency,
    })
    .from(schema.events)
    .where(and(eq(schema.events.tournamentId, tournament.id), eq(schema.events.id, eventId)))
    .limit(1);

  const event = events[0];
  if (event === undefined) return { error: 'That draw is not part of this tournament.' };
  if (event.status === 'notRun') return { error: 'That draw is not being held.' };

  if (event.discipline === 'doubles' && partnerName === '') {
    return { error: 'Doubles needs a partner name.' };
  }

  // Email is the identity key, unique within a draw: entering the same event
  // twice is a double-click, not a second entrant.
  const existing = await db()
    .select({ id: schema.entrants.id })
    .from(schema.entrants)
    .where(and(eq(schema.entrants.eventId, eventId), eq(schema.entrants.contactEmail, email)))
    .limit(1);
  if (existing[0] !== undefined) {
    return { error: 'That email is already entered in this draw.' };
  }

  const source =
    String(formData.get('source') ?? '')
      .trim()
      .slice(0, 32)
      .replace(/[^a-zA-Z0-9 _-]/g, '') || null;
  const { firstName, lastName } = splitName(fullName);

  /*
   * ENT-7. Every entry is written as a SUBMISSION first, whether or not the
   * club reviews them. That keeps one record of what was actually typed —
   * useful when two people turn up claiming the same slot — and means the
   * review queue has something to show even for clubs that never switch
   * review on.
   */
  const [submission] = await db()
    .insert(schema.entrySubmissions)
    .values({
      organizationId,
      tournamentId: tournament.id,
      firstName,
      lastName,
      email,
      phone,
      selections: { eventId, partnerName: partnerName === '' ? undefined : partnerName },
      rawPayload: { fullName, partnerName, eventId, source },
      // Lets someone return to their own entry without an account.
      statusToken: randomUUID(),
      submittedFromIp: ip,
      sourceLabel: source,
    })
    .returning({ id: schema.entrySubmissions.id });
  if (submission === undefined) return { error: 'Could not save your entry.' };

  /*
   * Default is to let them straight in: the club asked for self-registration
   * that appears in the admin panel immediately, with the organizer only
   * ticking who has paid. Review is opt-in per tournament.
   */
  let entrantId: string | null = null;
  if (!tournament.reviewEntries) {
    const accepted = await acceptSubmission(submission.id, null);
    if (accepted.error !== undefined) return { error: accepted.error };
    entrantId = accepted.entrantId ?? null;
  }

  revalidatePath(`/admin/${slug}`);

  const payable =
    stripeEnabled() && entrantId !== null && event.feeCents !== null && event.feeCents > 0
      ? {
          entrantId,
          feeLabel: formatAmount(event.feeCents, event.currency),
        }
      : {};

  return event.discipline === 'doubles'
    ? { ok: 'doubles', partner: partnerName, ...payable }
    : { ok: 'singles', ...payable };
}
