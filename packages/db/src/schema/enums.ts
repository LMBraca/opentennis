/**
 * Postgres enums.
 *
 * These mirror the engine's union types deliberately rather than importing
 * them: the engine is a pure package with no database knowledge, and a schema
 * that imported runtime values from it would invert that dependency. The
 * `assertEnumsMatchEngine` test in src/schema/enums.test.ts fails loudly if the
 * two ever drift.
 */

import { pgEnum } from 'drizzle-orm/pg-core';

export const disciplineEnum = pgEnum('discipline', ['singles', 'doubles']);

/**
 * Who may enter a draw.
 *
 * A third axis alongside category and discipline, so a club can run "A
 * Femenino" and "A Masculino" as separate draws of the same skill tier.
 *
 * `open` is the default and means unrestricted — it is what every existing
 * draw is, so adding this column changed no existing behaviour.
 */
export const divisionEnum = pgEnum('division', ['open', 'mens', 'womens']);

/**
 * Only `singles` and `doubles` in v1. Mixed doubles would make this a third
 * value and add a column to the category grid -- cheap now, awkward later
 * (PRD §12).
 */
export const tournamentStatusEnum = pgEnum('tournament_status', [
  'draft',
  'published',
  'inProgress',
  'complete',
  'cancelled',
]);

export const visibilityEnum = pgEnum('visibility', ['draft', 'unlisted', 'public']);

/**
 * `notRun` is distinct from `draft`: it means "we decided not to hold this",
 * which is what an under-filled category becomes. Hidden from the public site
 * by default so entrants who registered are not left wondering (PRD §5.3).
 */
export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'ready',
  'published',
  'inProgress',
  'complete',
  'notRun',
]);

export const stageKindEnum = pgEnum('stage_kind', [
  'roundRobin',
  'singleElimination',
  // Reserved for consolation draws (docs/consolation-draws-deferred.md). Listed
  // now because adding an enum value later needs a migration, and the whole
  // point of the guardrail is that the feature stays cheap to add.
  'consolation',
]);

export const roundKindEnum = pgEnum('round_kind', ['main', 'thirdPlace']);

export const matchStatusEnum = pgEnum('match_status', [
  'pending',
  'bye',
  'live',
  'complete',
]);

export const matchOutcomeEnum = pgEnum('match_outcome', [
  'completed',
  'walkover',
  'retirement',
  'default',
  'unfinished',
]);

/**
 * `pending` entrants come from the public entry form and are invisible to the
 * public site until an admin accepts them (PRD §4.2).
 */
export const entrantStatusEnum = pgEnum('entrant_status', [
  'pending',
  'active',
  'withdrawn',
  'noShow',
]);

export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'accepted',
  'rejected',
]);

export const memberRoleEnum = pgEnum('member_role', [
  'owner',
  'admin',
  'scorekeeper',
  'viewer',
]);

export const surfaceEnum = pgEnum('surface', ['hard', 'clay', 'grass', 'carpet', 'other']);

export const decidingSetModeEnum = pgEnum('deciding_set_mode', ['standard', 'matchTiebreak']);

export const formatKindEnum = pgEnum('format_kind', [
  'singleElimination',
  'roundRobin',
  'hybrid',
]);
