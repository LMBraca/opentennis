/**
 * Stripe webhook.
 *
 * The only inbound write besides public registration, and the only place a
 * payment is confirmed. Four things make it safe:
 *
 *   1. SIGNATURE VERIFICATION against the raw body. Without it anyone who
 *      finds this URL can mark entries paid, which is the whole prize.
 *   2. REPLAY PROTECTION. Stripe retries, so every event id is recorded and
 *      a repeat is a no-op rather than a second payment.
 *   3. IT ONLY WRITES PAYMENT STATE. A webhook cannot create an entrant,
 *      change a draw, or touch anything else.
 *   4. 200 ON EVERYTHING HANDLED. Returning an error makes Stripe retry for
 *      days; a payment we cannot match is logged, not retried forever.
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db } from '@/lib/db';
import { stripe, stripeEnabled } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function alreadySeen(eventId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: schema.webhookEvents.id })
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.providerEventId, eventId))
    .limit(1);
  return rows[0] !== undefined;
}

/** Map a Stripe session's payment method to our enum. */
function methodOf(session: Stripe.Checkout.Session): 'card' | 'oxxo' | 'spei' | 'other' {
  const types = session.payment_method_types ?? [];
  if (types.includes('oxxo')) return 'oxxo';
  if (types.includes('customer_balance')) return 'spei';
  if (types.includes('card')) return 'card';
  return 'other';
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });
  }

  const secret = process.env['STRIPE_WEBHOOK_SECRET'];
  if (secret === undefined || secret.trim() === '') {
    // Refuse rather than accept unverified events. An unsigned webhook is an
    // open endpoint for marking anything paid.
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (signature === null) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  // The RAW body: parsing it first would break signature verification.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(raw, signature, secret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid signature.' },
      { status: 400 },
    );
  }

  if (await alreadySeen(event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await db().insert(schema.webhookEvents).values({
    provider: 'stripe',
    providerEventId: event.id,
    eventType: event.type,
    payload: raw.slice(0, 20_000),
  });

  try {
    switch (event.type) {
      /* Card paid immediately, or an async voucher issued. */
      case 'checkout.session.completed': {
        const session = event.data.object;
        const entrantId = session.metadata?.['entrantId'] ?? session.client_reference_id;
        if (entrantId === null || entrantId === undefined) break;

        // An OXXO or SPEI session completes BEFORE the money arrives, so
        // "completed" is only paid when Stripe says it is.
        const settled = session.payment_status === 'paid';

        await upsertPayment(session, entrantId, settled ? 'succeeded' : 'pending');
        if (settled) await markEntrantPaid(entrantId, true);
        break;
      }

      /* The money actually landed: an OXXO voucher or SPEI transfer cleared. */
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const entrantId = session.metadata?.['entrantId'] ?? session.client_reference_id;
        if (entrantId === null || entrantId === undefined) break;
        await upsertPayment(session, entrantId, 'succeeded');
        await markEntrantPaid(entrantId, true);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const entrantId = session.metadata?.['entrantId'] ?? session.client_reference_id;
        if (entrantId === null || entrantId === undefined) break;
        await upsertPayment(session, entrantId, 'failed');
        break;
      }

      /* A voucher that was never paid. */
      case 'checkout.session.expired': {
        const session = event.data.object;
        if (session.id === undefined) break;
        await db()
          .update(schema.payments)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(schema.payments.providerSessionId, session.id));
        break;
      }

      /* Refunded from the Stripe dashboard: reflect it rather than let the
         app disagree with the money. */
      case 'charge.refunded': {
        const charge = event.data.object;
        const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (intent === null) break;
        const rows = await db()
          .update(schema.payments)
          .set({ status: 'refunded', updatedAt: new Date() })
          .where(eq(schema.payments.providerPaymentIntentId, intent))
          .returning({ entrantId: schema.payments.entrantId });
        for (const r of rows) await markEntrantPaid(r.entrantId, false);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    // Logged, not retried: Stripe would hammer this for days, and the
    // recorded event plus the dashboard are enough to reconcile by hand.
    console.error('[stripe webhook]', event.type, error);
  }

  return NextResponse.json({ ok: true });
}

async function upsertPayment(
  session: Stripe.Checkout.Session,
  entrantId: string,
  status: 'pending' | 'succeeded' | 'failed',
): Promise<void> {
  const organizationId = session.metadata?.['organizationId'];
  if (organizationId === undefined) return;

  const intent =
    typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const existing = await db()
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(eq(schema.payments.providerSessionId, session.id))
    .limit(1);

  const values = {
    status,
    providerPaymentIntentId: intent,
    paidAt: status === 'succeeded' ? new Date() : null,
    updatedAt: new Date(),
  };

  if (existing[0] !== undefined) {
    await db().update(schema.payments).set(values).where(eq(schema.payments.id, existing[0].id));
    return;
  }

  await db().insert(schema.payments).values({
    organizationId,
    entrantId,
    provider: 'stripe',
    method: methodOf(session),
    amountCents: session.amount_total ?? 0,
    currency: (session.currency ?? 'mxn').toUpperCase(),
    providerSessionId: session.id,
    ...values,
  });
}

async function markEntrantPaid(entrantId: string, paid: boolean): Promise<void> {
  await db()
    .update(schema.entrants)
    .set({ paid, paidAt: paid ? new Date() : null, updatedAt: new Date() })
    .where(eq(schema.entrants.id, entrantId));
}
