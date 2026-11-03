/**
 * Core schema: Organization, Category, Tournament, Event, Player, Entrant.
 *
 * Two guardrails are built in here rather than added later (PRD §9.1):
 *
 *   DB-3  Every tenant-scoped table carries `organizationId`, populated even
 *         though v1 serves one organization. Backfilling a tenant column into
 *         a live schema is tedious; an unused one is free.
 *
 *   DB-4  Tournament slugs are GLOBALLY unique, not per-organization. Public
 *         URLs are /t/:slug, and if slugs were per-org then going multi-tenant
 *         would force /:org/t/:slug -- breaking every printed QR code already
 *         taped to a clubhouse wall. The spec promises those keep working.
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './columns';
import {
  disciplineEnum,
  entrantStatusEnum,
  eventStatusEnum,
  formatKindEnum,
  memberRoleEnum,
  surfaceEnum,
  tournamentStatusEnum,
  visibilityEnum,
} from './enums';

/* ------------------------------------------------------------------------- */
/* Organization                                                              */
/* ------------------------------------------------------------------------- */

export const organizations = pgTable(
  'organizations',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoUrl: text('logo_url'),
    /** Single accent override. The design system allows exactly one. */
    accentColor: text('accent_color'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('organizations_slug_unique').on(t.slug)],
);

/* ------------------------------------------------------------------------- */
/* Users and membership                                                      */
/* ------------------------------------------------------------------------- */

/**
 * Only administrators have accounts. Entrants are records, not users, and
 * there is deliberately no player role (PRD §4.1).
 */
export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name'),
    emailVerified: boolean('email_verified').notNull().default(false),
    imageUrl: text('image_url'),
    /**
     * scrypt hash, stored as "scrypt$N$r$p$salt$hash" so the work factors
     * travel with the hash and can be raised later without invalidating
     * existing passwords.
     */
    passwordHash: text('password_hash'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('admin'),
    ...timestamps(),
  },
  (t) => [
    unique('memberships_org_user_unique').on(t.organizationId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);

/**
 * Sessions.
 *
 * Server-side rather than a self-contained JWT, so signing out and revoking
 * access are the same operation -- which matters when an admin leaves a club
 * and a stateless token would stay valid until it expired.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_unique').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Category ladder                                                           */
/* ------------------------------------------------------------------------- */

/**
 * The skill ladder: Open, A, B, C+, C, D.
 *
 * Organization-level, NOT per-tournament, so "B" means the same thing in March
 * as in September. A per-tournament ladder would break any cross-tournament
 * history before it was ever written.
 */
export const categories = pgTable(
  'categories',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** "Open", "A", "C+". Short, displayed verbatim. */
    code: text('code').notNull(),
    /** URL-safe form: "open", "a", "c-plus". */
    slug: text('slug').notNull(),
    label: text('label'),
    /**
     * Ladder position, ascending from the strongest. Drives display order
     * EVERYWHERE -- an alphabetical sort yielding A, B, C, C+, D, Open reads as
     * broken to anyone who plays.
     */
    rank: integer('rank').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique('categories_org_code_unique').on(t.organizationId, t.code),
    unique('categories_org_slug_unique').on(t.organizationId, t.slug),
    index('categories_org_rank_idx').on(t.organizationId, t.rank),
  ],
);

/* ------------------------------------------------------------------------- */
/* Tournament                                                                */
/* ------------------------------------------------------------------------- */

export const tournaments = pgTable(
  'tournaments',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /**
     * GLOBALLY unique -- see the DB-4 note at the top of this file. Short and
     * readable, because people read these aloud off posters.
     */
    slug: text('slug').notNull(),
    venue: text('venue'),
    /** IANA zone. Match times are absolute; this is how they are displayed. */
    timezone: text('timezone').notNull().default('UTC'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    status: tournamentStatusEnum('status').notNull().default('draft'),
    visibility: visibilityEnum('visibility').notNull().default('draft'),
    /** Public entry form open? Independent of visibility (PRD §4.2). */
    entriesOpen: boolean('entries_open').notNull().default(false),
    /** Turnstile on the entry form. Default on for public tournaments. */
    requireCaptcha: boolean('require_captcha').notNull().default(true),

    /** Courts this tournament may use. May be fewer than the club owns. */
    courtCount: integer('court_count').notNull().default(2),
    /** Court time per match, including changeover. */
    matchMinutes: integer('match_minutes').notNull().default(60),
    /** Minimum gap between one entrant's matches. */
    minRestMinutes: integer('min_rest_minutes').notNull().default(60),
    /**
     * Playable hours, as [{ dayOfWeek, startMinutes, endMinutes }].
     * JSON rather than a table: it is read and written whole, never queried
     * by window, and a club edits it as one form.
     */
    availabilityWindows: jsonb('availability_windows'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('tournaments_slug_unique').on(t.slug),
    index('tournaments_org_idx').on(t.organizationId),
  ],
);

export const courts = pgTable(
  'courts',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    surface: surfaceEnum('surface').notNull().default('hard'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique('courts_tournament_name_unique').on(t.tournamentId, t.name),
    index('courts_tournament_idx').on(t.tournamentId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Event = category x discipline                                             */
/* ------------------------------------------------------------------------- */

/**
 * One cell of the category grid.
 *
 * `Event` is the JOIN of a category and a discipline, not a free-text label.
 * That is what makes the admin setup grid, the public category switcher, and
 * season templates possible -- and it guarantees every draw is addressable as
 * "C+ Doubles" rather than whatever an organizer typed.
 */
export const events = pgTable(
  'events',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    discipline: disciplineEnum('discipline').notNull(),

    format: formatKindEnum('format').notNull(),
    status: eventStatusEnum('status').notNull().default('draft'),

    /** Scoring config, stored flat so it can be queried and defaulted. */
    setsToWin: integer('sets_to_win').notNull().default(2),
    gamesPerSet: integer('games_per_set').notNull().default(6),
    /** Null means an advantage set: win by two, no upper bound. */
    tiebreakAt: integer('tiebreak_at').default(6),
    tiebreakTo: integer('tiebreak_to').notNull().default(7),
    decidingSetMode: text('deciding_set_mode').notNull().default('standard'),
    adScoring: boolean('ad_scoring').notNull().default(true),

    /** Round robin options. */
    doubleRoundRobin: boolean('double_round_robin').notNull().default(false),
    /** Hybrid options. */
    groupCount: integer('group_count'),
    qualifiersPerGroup: integer('qualifiers_per_group'),

    thirdPlacePlayoff: boolean('third_place_playoff').notNull().default(false),

    /**
     * Advisory threshold only. Below this the grid cell is flagged, but
     * generation is NEVER blocked -- an admin who wants to run a 3-person
     * round robin just generates it (PRD §5.3).
     */
    minEntrants: integer('min_entrants').notNull().default(4),

    /** Persisted so a draw is reproducible and auditable. */
    drawRandomSeed: text('draw_random_seed'),
    /** Set when an admin drags an entrant into a specific slot. */
    manuallyAdjusted: boolean('manually_adjusted').notNull().default(false),

    ...timestamps(),
  },
  (t) => [
    // One cell per category x discipline per tournament. This constraint is
    // what makes the grid a grid.
    unique('events_tournament_category_discipline_unique').on(
      t.tournamentId,
      t.categoryId,
      t.discipline,
    ),
    index('events_tournament_idx').on(t.tournamentId),
    index('events_org_idx').on(t.organizationId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Players and entrants                                                      */
/* ------------------------------------------------------------------------- */

/**
 * A person. Reusable across tournaments, which is what makes a player's
 * cross-event page whole across seasons.
 *
 * `email` is the canonical identity key (PRD §4.1). It is unique per
 * organization for FORM registrations, but deliberately NULLABLE and
 * non-unique at the schema level: households share addresses, and an admin
 * entering someone from a paper sheet may have no address at all. The
 * uniqueness check lives in the entry-form path, not here -- see
 * `assertEmailAvailable` in src/players.ts.
 *
 * There is no rating column. The product has no concept of player skill.
 */
export const players = pgTable(
  'players',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    clubAffiliation: text('club_affiliation'),
    ...timestamps(),
  },
  (t) => [
    index('players_org_idx').on(t.organizationId),
    // Surname first: the directory is browsed and sorted by surname, and
    // near-identical names must sort ADJACENT so an admin notices duplicates
    // unaided (PRD §4.1).
    index('players_org_name_idx').on(t.organizationId, t.lastName, t.firstName),
    index('players_org_email_idx').on(t.organizationId, t.email),
  ],
);

/**
 * The draw's atomic unit: one player for singles, two for doubles.
 *
 * `seed` is admin-assigned or null, never computed -- there are no ratings to
 * sort by, and most draws arrive fully unseeded.
 */
export const entrants = pgTable(
  'entrants',
  {
    id: id(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    seed: integer('seed'),
    status: entrantStatusEnum('status').notNull().default('pending'),
    /** Set when this entrant came from a public submission. */
    submissionId: text('submission_id'),

    /**
     * Has the entry fee been paid?
     *
     * A tick, deliberately not a ledger. No amount, no method, no currency --
     * the full fee design is parked in docs/entry-fees-deferred.md. The
     * organizer's actual pain is remembering WHO paid, and a boolean answers
     * that; money still changes hands at the desk.
     */
    paid: boolean('paid').notNull().default(false),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    /** Contact details, captured at self-registration. Admin-only. */
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    ...timestamps(),
  },
  (t) => [
    index('entrants_event_idx').on(t.eventId),
    index('entrants_event_status_idx').on(t.eventId, t.status),
    // A seed can only be used once within an event. Postgres treats NULLs as
    // distinct, so this permits any number of unseeded entrants -- exactly the
    // behaviour wanted, since unseeded is the common case.
    unique('entrants_event_seed_unique').on(t.eventId, t.seed),
  ],
);

/** Join table. One row for singles, two for doubles. */
export const entrantPlayers = pgTable(
  'entrant_players',
  {
    id: id(),
    entrantId: text('entrant_id')
      .notNull()
      .references(() => entrants.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'restrict' }),
    /** 0 or 1. Determines display order within a doubles pairing. */
    position: integer('position').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique('entrant_players_unique').on(t.entrantId, t.playerId),
    unique('entrant_players_position_unique').on(t.entrantId, t.position),
    index('entrant_players_player_idx').on(t.playerId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Relations                                                                 */
/* ------------------------------------------------------------------------- */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  categories: many(categories),
  tournaments: many(tournaments),
  players: many(players),
  memberships: many(memberships),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [categories.organizationId],
    references: [organizations.id],
  }),
  events: many(events),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tournaments.organizationId],
    references: [organizations.id],
  }),
  events: many(events),
  courts: many(courts),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [events.tournamentId],
    references: [tournaments.id],
  }),
  category: one(categories, {
    fields: [events.categoryId],
    references: [categories.id],
  }),
  entrants: many(entrants),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [players.organizationId],
    references: [organizations.id],
  }),
  entrantPlayers: many(entrantPlayers),
}));

export const entrantsRelations = relations(entrants, ({ one, many }) => ({
  event: one(events, { fields: [entrants.eventId], references: [events.id] }),
  players: many(entrantPlayers),
}));

export const entrantPlayersRelations = relations(entrantPlayers, ({ one }) => ({
  entrant: one(entrants, {
    fields: [entrantPlayers.entrantId],
    references: [entrants.id],
  }),
  player: one(players, {
    fields: [entrantPlayers.playerId],
    references: [players.id],
  }),
}));
