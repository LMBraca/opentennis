/**
 * Shared column builders.
 *
 * Centralised so that every table agrees on id generation and timestamp
 * semantics. A schema where half the tables use `timestamp` and half use
 * `timestamptz` is a bug waiting for a tournament that spans a DST boundary.
 */

import { sql } from 'drizzle-orm';
import { text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Primary key. Generated database-side so an insert never has to round-trip
 * for an id, and readable enough to paste into a support conversation.
 */
export const id = () =>
  text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);

/**
 * Always `withTimezone`. Tournaments are scheduled in a venue's local time but
 * stored absolute; a naive timestamp would silently shift every match in a
 * tournament that crosses a daylight-saving change.
 */
export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
