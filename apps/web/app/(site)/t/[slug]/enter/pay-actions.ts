'use server';

/**
 * Start a Stripe Checkout session for an entrant.
 *
 * The amount is read from the EVENT, never from the request. A price that
 * arrives in a form body is a price an attacker can set to zero.
 */

import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { createCheckoutSession, stripeEnabled } from '@/lib/stripe';

export interface PayState {
  readonly error?: string;
  readonly url?: string;
}

export async function startCheckout(entrantId: string): Promise<PayState> {
  if (!stripeEnabled()) return { error: 'Online payment is not set up for this club.' };
  const organizationId = orgId();

  const rows = await db()
    .select({
      entrantId: schema.entrants.id,
      email: schema.entrants.contactEmail,
      paid: schema.entrants.paid,
      feeCents: schema.events.entryFeeCents,
      currency: schema.events.currency,
      discipline: schema.events.discipline,
      code: schema.categories.code,
      tournamentName: schema.tournaments.name,
      tournamentSlug: schema.tournaments.slug,
    })
    .from(schema.entrants)
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .where(
      and(eq(schema.entrants.organizationId, organizationId), eq(schema.entrants.id, entrantId)),
    )
    .limit(1);

  const row = rows[0];
  if (row === undefined) return { error: 'Entry not found.' };
  if (row.paid) return { error: 'This entry is already paid.' };
  if (row.feeCents === null || row.feeCents <= 0) {
    return { error: 'This category has no entry fee.' };
  }

  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const base = `${proto}://${host}`;

  try {
    const session = await createCheckoutSession({
      entrantId: row.entrantId,
      organizationId,
      amountCents: row.feeCents,
      currency: row.currency,
      description: `${row.tournamentName} — ${row.code} ${row.discipline}`,
      email: row.email,
      successUrl: `${base}/t/${row.tournamentSlug}/enter?paid=1`,
      cancelUrl: `${base}/t/${row.tournamentSlug}/enter?cancelled=1`,
    });

    if (session.url === null) return { error: 'Stripe did not return a checkout URL.' };
    return { url: session.url };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not start checkout.' };
  }
}
