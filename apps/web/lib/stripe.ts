/**
 * Stripe.
 *
 * One integration covers the three rails a Mexican club needs: cards, SPEI
 * bank transfer, and OXXO cash vouchers. PayPal was deliberately left out —
 * it is a second SDK, a second webhook, and a second place to issue refunds,
 * for a rail that is mostly used cross-border rather than for local fees.
 *
 * Checkout happens on Stripe's hosted page. No card number ever reaches this
 * server, which keeps us at PCI SAQ-A and means a breach here exposes no card
 * data because none exists.
 *
 * EVERYTHING HERE DEGRADES. With no STRIPE_SECRET_KEY the app runs exactly as
 * it did before: the pay buttons disappear and the manual tick still works.
 * A club that never configures Stripe should not see a broken product.
 */

import 'server-only';
import Stripe from 'stripe';

let cached: Stripe | undefined;

export function stripeEnabled(): boolean {
  const key = process.env['STRIPE_SECRET_KEY'];
  return key !== undefined && key.trim() !== '';
}

export function stripe(): Stripe {
  if (cached !== undefined) return cached;
  const key = process.env['STRIPE_SECRET_KEY'];
  if (key === undefined || key.trim() === '') {
    throw new Error('STRIPE_SECRET_KEY is not set. Payments are disabled.');
  }
  // No pinned apiVersion: the SDK's default is the one its types describe,
  // and pinning a different string makes every param type a lie.
  cached = new Stripe(key);
  return cached;
}

/**
 * OXXO and SPEI are only available on a Mexican Stripe account, and only for
 * MXN. Offering them on a USD charge produces a confusing Stripe error rather
 * than a useful one, so the decision is made here.
 */
export function methodsFor(
  currency: string,
): Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[] {
  return currency.toUpperCase() === 'MXN'
    ? ['card', 'oxxo', 'customer_balance']
    : ['card'];
}

export interface CheckoutInput {
  readonly entrantId: string;
  readonly organizationId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly description: string;
  readonly email: string | null;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<{ id: string; url: string | null }> {
  const currency = input.currency.toLowerCase();
  const methods = methodsFor(input.currency);

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    allowed_payment_method_types: methods,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: input.amountCents,
          product_data: { name: input.description },
        },
      },
    ],
    // The entrant id travels with the payment, so the webhook matches on an
    // identifier rather than fuzzy-matching a name and email that the payer
    // may have typed differently.
    client_reference_id: input.entrantId,
    metadata: {
      entrantId: input.entrantId,
      organizationId: input.organizationId,
    },
    ...(input.email === null ? {} : { customer_email: input.email }),
    ...(methods.includes('customer_balance')
      ? {
          payment_method_options: {
            customer_balance: {
              funding_type: 'bank_transfer',
              bank_transfer: { type: 'mx_bank_transfer' },
            },
          },
          customer_creation: 'always' as const,
        }
      : {}),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // An unpaid session is noise in the dashboard after a day.
    expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });

  return { id: session.id, url: session.url };
}

/** Minor units to a readable amount. 25000 MXN cents → "$250.00". */
export function formatAmount(cents: number, currency: string, locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
