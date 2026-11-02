/**
 * Draw structure: Stage, Group, Round, Match, MatchSide, Set, plus the
 * ScoreEvent log and materialised Standing rows.
 *
 * DB-5 GUARDRAIL. `Stage` is a real table with its own identity and a
 * nullable `parentStageId`, NOT an enum column on `events`. Collapsing it
 * would foreclose consolation draws, and the renderer contract is that it
 * takes a STAGE, not an event (docs/consolation-draws-deferred.md §4). The
 * cost of keeping it is one join; the cost of removing it is a migration plus
 * a renderer rewrite.
 */

import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns';
import {
  matchOutcomeEnum,
  matchStatusEnum,
  roundKindEnum,
  stageKindEnum,
} from './enums';
import { courts, entrants, events, users } from './core';

export const stages = pgTable(
  'stages',
  {
    id: id(),
    organizationId: text('organization_id').notNull(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    kind: stageKindEnum('kind').notNull(),
    /** Ordered within an event: group stage, then playoff. */
    sortOrder: integer('sort_order').notNull().default(0),
    name: text('name'),
    /**
     * Self-reference for a consolation stage pointing at its main draw. Unused
     * in v1 and deliberately present -- see the DB-5 note above.
     */
    parentStageId: text('parent_stage_id'),
    /** Format-specific config the engine needs to regenerate this stage. */
    config: jsonb('config'),
    ...timestamps(),
  },
  (t) => [
    unique('stages_event_order_unique').on(t.eventId, t.sortOrder),
    index('stages_event_idx').on(t.eventId),
    index('stages_parent_idx').on(t.parentStageId),
  ],
);

/**
 * Round robin pools. NUMBERED, never lettered -- letters are skill categories,
 * and "Group B of the C+ draw" versus "the B draw" is how a player ends up on
 * the wrong court.
 */
export const groups = pgTable(
  'groups',
  {
    id: id(),
    organizationId: text('organization_id').notNull(),
    stageId: text('stage_id')
      .notNull()
      .references(() => stages.id, { onDelete: 'cascade' }),
    /** "Group 1", "Group 2". */
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * Set when a withdrawal forced an adjustment, with the reason. The public
     * table shows this as a note: a silently altered standings table destroys
     * an organizer's credibility (docs/tournament-formats.md §3.6).
     */
    adjustmentNote: text('adjustment_note'),
    ...timestamps(),
  },
  (t) => [
    unique('groups_stage_order_unique').on(t.stageId, t.sortOrder),
    index('groups_stage_idx').on(t.stageId),
  ],
);

export const groupEntrants = pgTable(
  'group_entrants',
  {
    id: id(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    entrantId: text('entrant_id')
      .notNull()
      .references(() => entrants.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (t) => [
    unique('group_entrants_unique').on(t.groupId, t.entrantId),
    index('group_entrants_entrant_idx').on(t.entrantId),
  ],
);

export const rounds = pgTable(
  'rounds',
  {
    id: id(),
    organizationId: text('organization_id').notNull(),
    stageId: text('stage_id')
      .notNull()
      .references(() => stages.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    /** 0-based. */
    roundIndex: integer('round_index').notNull(),
    /** "Final", "Semifinal", "Round of 16", "Round 3". */
    name: text('name').notNull(),
    kind: roundKindEnum('kind').notNull().default('main'),
    /**
     * Who sits out this round. Only ever populated for an odd-field round
     * robin. An idle entrant is NOT on a bye -- conflating the two would
     * corrupt the percentage tiebreakers.
     */
    idleEntrantIds: jsonb('idle_entrant_ids'),
    ...timestamps(),
  },
  (t) => [
    index('rounds_stage_idx').on(t.stageId),
    index('rounds_group_idx').on(t.groupId),
  ],
);

export const matches = pgTable(
  'matches',
  {
    id: id(),
    organizationId: text('organization_id').notNull(),
    /** Denormalised for the cross-event scheduler, which spans a tournament. */
    tournamentId: text('tournament_id').notNull(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    roundId: text('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),

    /** Engine-assigned, deterministic: "r0m3", "g1r0m0". */
    engineMatchId: text('engine_match_id').notNull(),
    slotIndex: integer('slot_index').notNull(),

    status: matchStatusEnum('status').notNull().default('pending'),
    outcome: matchOutcomeEnum('outcome'),
    winnerEntrantId: text('winner_entrant_id').references(() => entrants.id, {
      onDelete: 'set null',
    }),

    courtId: text('court_id').references(() => courts.id, { onDelete: 'set null' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    ...timestamps(),
  },
  (t) => [
    unique('matches_round_slot_unique').on(t.roundId, t.slotIndex),
    index('matches_event_idx').on(t.eventId),
    index('matches_round_idx').on(t.roundId),
    // Drives the live strip and the SSE stream.
    index('matches_tournament_status_idx').on(t.tournamentId, t.status),
    // Drives the scheduler's day view and conflict detection.
    index('matches_court_scheduled_idx').on(t.courtId, t.scheduledAt),
  ],
);

/**
 * Two rows per match.
 *
 * `sourceRef` is the mechanism that lets a full bracket exist before any ball
 * is hit: an undecided side carries a pointer to the match that will feed it,
 * so the public bracket renders "Winner of QF2" rather than an empty box.
 */
export const matchSides = pgTable(
  'match_sides',
  {
    id: id(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    /** 0 or 1. */
    position: integer('position').notNull(),
    entrantId: text('entrant_id').references(() => entrants.id, { onDelete: 'set null' }),
    /** 'winnerOf' | 'loserOf' | 'groupRank' | 'bye' */
    sourceKind: text('source_kind'),
    /** For winnerOf / loserOf: the feeding match's engine id. */
    sourceMatchId: text('source_match_id'),
    /** For groupRank: which pool and which finishing position. */
    sourceGroupId: text('source_group_id'),
    sourceRank: integer('source_rank'),
    ...timestamps(),
  },
  (t) => [
    unique('match_sides_position_unique').on(t.matchId, t.position),
    index('match_sides_entrant_idx').on(t.entrantId),
  ],
);

export const sets = pgTable(
  'sets',
  {
    id: id(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    /** 0-based. */
    setIndex: integer('set_index').notNull(),
    side0Games: integer('side0_games').notNull(),
    side1Games: integer('side1_games').notNull(),
    /** Null unless the set went to a tiebreak. */
    side0TiebreakPoints: integer('side0_tiebreak_points'),
    side1TiebreakPoints: integer('side1_tiebreak_points'),
    ...timestamps(),
  },
  (t) => [unique('sets_match_index_unique').on(t.matchId, t.setIndex)],
);

/**
 * DB-6: append-only audit log.
 *
 * Never updated, never deleted. Backs undo, and answers "who entered this
 * score and when" -- which matters because scorekeepers are volunteers with
 * link tokens rather than accounts.
 */
export const scoreEvents = pgTable(
  'score_events',
  {
    id: id(),
    organizationId: text('organization_id').notNull(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    /** Null when the actor was a link-token scorekeeper rather than a user. */
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorLabel: text('actor_label'),
    /**
     * Client-generated. Makes submission idempotent so a double-tap or a
     * retried request cannot double-apply (PRD §5.4).
     */
    clientEventId: text('client_event_id').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    /** Set when a later event reverted this one. */
    revertedByEventId: text('reverted_by_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The idempotency guarantee, enforced by the database rather than by
    // application care.
    unique('score_events_client_id_unique').on(t.matchId, t.clientEventId),
    index('score_events_match_idx').on(t.matchId, t.createdAt),
  ],
);

/**
 * DB-7: materialised standings.
 *
 * Derived from matches, recomputed on result change. Stored because the public
 * standings page is read far more often than it changes, and because the
 * tiebreaker trace is expensive to recompute per request.
 */
export const standings = pgTable(
  'standings',
  {
    id: id(),
    organizationId: text('organization_id').notNull(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    entrantId: text('entrant_id')
      .notNull()
      .references(() => entrants.id, { onDelete: 'cascade' }),

    rank: integer('rank').notNull(),
    matchesPlayed: integer('matches_played').notNull().default(0),
    matchesWon: integer('matches_won').notNull().default(0),
    matchesLost: integer('matches_lost').notNull().default(0),
    setsWon: integer('sets_won').notNull().default(0),
    setsLost: integer('sets_lost').notNull().default(0),
    gamesWon: integer('games_won').notNull().default(0),
    gamesLost: integer('games_lost').notNull().default(0),
    points: integer('points').notNull().default(0),

    /**
     * The TiebreakStep[] that produced this ranking, so the public view can
     * answer "why is Priya above Marco?" without recomputing the cascade.
     */
    tiebreakTrace: jsonb('tiebreak_trace'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('standings_group_entrant_unique').on(t.groupId, t.entrantId),
    index('standings_group_rank_idx').on(t.groupId, t.rank),
  ],
);

/* ------------------------------------------------------------------------- */
/* Relations                                                                 */
/* ------------------------------------------------------------------------- */

export const stagesRelations = relations(stages, ({ one, many }) => ({
  event: one(events, { fields: [stages.eventId], references: [events.id] }),
  rounds: many(rounds),
  groups: many(groups),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  stage: one(stages, { fields: [groups.stageId], references: [stages.id] }),
  entrants: many(groupEntrants),
  standings: many(standings),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  stage: one(stages, { fields: [rounds.stageId], references: [stages.id] }),
  group: one(groups, { fields: [rounds.groupId], references: [groups.id] }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  round: one(rounds, { fields: [matches.roundId], references: [rounds.id] }),
  event: one(events, { fields: [matches.eventId], references: [events.id] }),
  court: one(courts, { fields: [matches.courtId], references: [courts.id] }),
  sides: many(matchSides),
  sets: many(sets),
  scoreEvents: many(scoreEvents),
}));

export const matchSidesRelations = relations(matchSides, ({ one }) => ({
  match: one(matches, { fields: [matchSides.matchId], references: [matches.id] }),
  entrant: one(entrants, { fields: [matchSides.entrantId], references: [entrants.id] }),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  match: one(matches, { fields: [sets.matchId], references: [matches.id] }),
}));
