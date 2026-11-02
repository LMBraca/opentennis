/**
 * DB-8: public entry submissions, and scorekeeper link tokens.
 *
 * A submission is the only thing an unauthenticated request can create, and it
 * can only ever land as `pending` -- never a Player, never an Entrant, never
 * anything the public site renders (PRD §4.2). Crossing that boundary always
 * requires an admin action.
 */

import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns';
import { submissionStatusEnum } from './enums';
import { organizations, players, tournaments, users } from './core';

export const entrySubmissions = pgTable(
  'entry_submissions',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),

    /** Required at registration. All four. */
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    clubAffiliation: text('club_affiliation'),

    /** [{ categoryId, discipline, partnerEmail?, partnerName? }, ...] */
    selections: jsonb('selections').notNull(),

    /**
     * The submission exactly as received, kept even after acceptance. The audit
     * trail for "who said they wanted to play C+" when a dispute arises, and
     * what makes a spam flood auditable and bulk-rejectable.
     */
    rawPayload: jsonb('raw_payload').notNull(),

    status: submissionStatusEnum('status').notNull().default('pending'),

    /**
     * Opaque token for the bookmarkable status URL. The submitter gets no
     * email -- this and the public bracket are the only feedback channels.
     */
    statusToken: text('status_token').notNull(),

    /** Resolved by email lookup; set when this is a returning player. */
    matchedPlayerId: text('matched_player_id').references(() => players.id, {
      onDelete: 'set null',
    }),

    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    /** Rate limiting and abuse auditing. Not used for tracking. */
    submittedFromIp: text('submitted_from_ip'),
    /** Optional per-QR attribution label: "clubhouse-board", "instagram". */
    sourceLabel: text('source_label'),

    ...timestamps(),
  },
  (t) => [
    unique('entry_submissions_token_unique').on(t.statusToken),
    index('entry_submissions_tournament_status_idx').on(t.tournamentId, t.status),
    // The review queue reads newest-first.
    index('entry_submissions_created_idx').on(t.tournamentId, t.createdAt),
    // Email lookup at submit time, for returning-player resolution.
    index('entry_submissions_email_idx').on(t.tournamentId, t.email),
  ],
);

/**
 * Scorekeeper access without an account.
 *
 * The volunteer-parent persona will not create one, and requiring it means
 * scores get texted to the director instead. Scoped to a single tournament,
 * revocable, and expiring with the event.
 */
export const scorekeeperTokens = pgTable(
  'scorekeeper_tokens',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    /** Stored hashed. The plaintext is shown once, at creation. */
    tokenHash: text('token_hash').notNull(),
    /** Human label so an admin knows which link to revoke: "Marco (courts 1-4)". */
    label: text('label').notNull(),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique('scorekeeper_tokens_hash_unique').on(t.tokenHash),
    index('scorekeeper_tokens_tournament_idx').on(t.tournamentId),
  ],
);

/**
 * Reusable category grid, so a club running the same events every season does
 * not reconfigure twelve cells each time. The single highest-leverage feature
 * in the admin panel, and it only works because the grid is structured data
 * rather than typed event names.
 */
export const gridTemplates = pgTable(
  'grid_templates',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** [{ categoryId, discipline, format, scoring..., }, ...] */
    cells: jsonb('cells').notNull(),
    ...timestamps(),
  },
  (t) => [unique('grid_templates_org_name_unique').on(t.organizationId, t.name)],
);

/**
 * Reversible player merges, for the one case email uniqueness cannot catch:
 * a real person who registered under two different addresses.
 */
export const playerMerges = pgTable(
  'player_merges',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    canonicalPlayerId: text('canonical_player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** Kept as a row rather than deleted, so the merge can be undone. */
    mergedPlayerId: text('merged_player_id').notNull(),
    mergedSnapshot: jsonb('merged_snapshot').notNull(),
    /** Entrant ids reassigned, so an undo knows exactly what to put back. */
    reassignedEntrantIds: jsonb('reassigned_entrant_ids').notNull(),
    performedByUserId: text('performed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    revertedAt: timestamp('reverted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('player_merges_canonical_idx').on(t.canonicalPlayerId)],
);

export const entrySubmissionsRelations = relations(entrySubmissions, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [entrySubmissions.tournamentId],
    references: [tournaments.id],
  }),
  matchedPlayer: one(players, {
    fields: [entrySubmissions.matchedPlayerId],
    references: [players.id],
  }),
}));
