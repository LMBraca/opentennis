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
import { headers } from 'next/headers';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
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

function splitName(full: string): { firstName: string; lastName: string } {
  const words = full.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { firstName: '', lastName: words[0] ?? '' };
  return { firstName: words.slice(0, -1).join(' '), lastName: words.at(-1) as string };
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
    .select({ id: schema.tournaments.id, entriesOpen: schema.tournaments.entriesOpen })
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

  const [entrant] = await db()
    .insert(schema.entrants)
    .values({
      organizationId,
      eventId,
      // Active immediately: there is no approval queue by design.
      status: 'active',
      contactEmail: email,
      contactPhone: phone,
      paid: false,
    })
    .returning({ id: schema.entrants.id });
  if (entrant === undefined) return { error: 'Could not save your entry.' };

  const people = event.discipline === 'doubles' ? [fullName, partnerName] : [fullName];
  for (const [position, person] of people.entries()) {
    const { firstName, lastName } = splitName(person);
    const [player] = await db()
      .insert(schema.players)
      .values({
        organizationId,
        firstName,
        lastName,
        // Only the person who filled the form gets their contact stored.
        email: position === 0 ? email : null,
        phone: position === 0 ? phone : null,
      })
      .returning({ id: schema.players.id });
    if (player === undefined) continue;
    await db()
      .insert(schema.entrantPlayers)
      .values({ entrantId: entrant.id, playerId: player.id, position });
  }

  revalidatePath(`/admin/${slug}`);

  const payable =
    stripeEnabled() && event.feeCents !== null && event.feeCents > 0
      ? {
          entrantId: entrant.id,
          feeLabel: formatAmount(event.feeCents, event.currency),
        }
      : {};

  return event.discipline === 'doubles'
    ? { ok: 'doubles', partner: partnerName, ...payable }
    : { ok: 'singles', ...payable };
}
