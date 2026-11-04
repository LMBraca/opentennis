/**
 * Payments.
 *
 * The app NEVER touches a card number. Checkout happens on Stripe's own
 * hosted page, which keeps us at PCI SAQ-A — the lightest tier — and means a
 * breach here exposes no card data because none exists.
 *
 * The app also never initiates an outbound refund. When a category is not
 * held, it lists who is owed what and the organizer refunds from Stripe's
 * dashboard. Moving money out is a far higher-stakes code path than taking
 * it in, and it is not worth owning for a club tournament.
 */

import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './columns';
import { paymentMethodEnum, paymentStatusEnum } from './enums';
import { entrants, organizations, users } from './core';

export const payments = pgTable(
  'payments',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    entrantId: text('entrant_id')
      .notNull()
      .references(() => entrants.id, { onDelete: 'cascade' }),

    /** 'stripe' or 'manual'. Manual is the tick at the desk. */
    provider: text('provider').notNull(),
    method: paymentMethodEnum('method').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),

    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('MXN'),

    /** Stripe Checkout Session id. Unique, so a replayed webhook is a no-op. */
    providerSessionId: text('provider_session_id'),
    providerPaymentIntentId: text('provider_payment_intent_id'),

    /**
     * The OXXO voucher or SPEI instructions URL. Worth storing: a player who
     * loses the tab needs it again, and an organizer gets asked for it.
     */
    hostedInstructionsUrl: text('hosted_instructions_url'),

    /** OXXO vouchers expire. After this the payment is dead, not pending. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    /** Set when an admin ticked it rather than Stripe confirming it. */
    recordedByUserId: text('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    note: text('note'),

    ...timestamps(),
  },
  (t) => [
    // Idempotency: Stripe retries webhooks, and a duplicate must not create
    // a second payment row.
    uniqueIndex('payments_session_unique').on(t.providerSessionId),
    index('payments_entrant_idx').on(t.entrantId),
    index('payments_status_idx').on(t.organizationId, t.status),
  ],
);

/**
 * Raw webhook events, kept verbatim.
 *
 * The audit trail for "we never received that payment" and the mechanism for
 * replay-safety: a repeated Stripe event id is ignored.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: id(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: text('payload').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('webhook_events_provider_event_unique').on(t.provider, t.providerEventId)],
);
