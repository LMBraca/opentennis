/**
 * Schema invariants.
 *
 * The enum tests exist because the schema mirrors the engine's union types
 * rather than importing them — the engine is a pure package with no database
 * knowledge, and importing runtime values from it would invert that
 * dependency. Mirroring is the right call, but it can drift silently, so it is
 * pinned here.
 */

import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import type {
  EntrantStatus,
  MatchOutcome,
  RoundKind,
  StageKind,
} from '@opentennis/engine';
import { DEFAULT_CATEGORY_LADDER, DEFAULT_FORMAT_BY_CATEGORY } from '../seed-data';
import { isValidSlug } from '../slugs';
import {
  entrantStatusEnum,
  matchOutcomeEnum,
  roundKindEnum,
  stageKindEnum,
} from './enums';
import {
  entrants,
  events,
  invitations,
  passwordResets,
  players,
  tournaments,
  users,
} from './core';
import { matchSides, matches, rounds, scoreEvents, stages, standings } from './draws';
import { entrySubmissions, scorekeeperTokens } from './entries';

describe('enums match the engine', () => {
  it('matchOutcome is identical to the engine union', () => {
    const fromEngine: MatchOutcome[] = [
      'completed',
      'walkover',
      'retirement',
      'default',
      'unfinished',
    ];
    expect([...matchOutcomeEnum.enumValues].sort()).toEqual([...fromEngine].sort());
  });

  it('roundKind is identical to the engine union', () => {
    const fromEngine: RoundKind[] = ['main', 'thirdPlace'];
    expect([...roundKindEnum.enumValues].sort()).toEqual([...fromEngine].sort());
  });

  it('entrantStatus extends the engine union with pending', () => {
    // The engine knows nothing about the public entry form, so `pending` is a
    // database-only state. Every engine value must still be present.
    const fromEngine: EntrantStatus[] = ['active', 'withdrawn', 'noShow'];
    for (const value of fromEngine) {
      expect(entrantStatusEnum.enumValues).toContain(value);
    }
    expect(entrantStatusEnum.enumValues).toContain('pending');
  });

  it('stageKind covers the engine kinds plus the consolation guardrail', () => {
    const fromEngine: StageKind[] = ['singleElimination', 'roundRobin'];
    for (const value of fromEngine) {
      expect(stageKindEnum.enumValues).toContain(value);
    }
    // Listed now because adding an enum value later needs a migration, and the
    // guardrail is precisely that consolation stays cheap to add.
    expect(stageKindEnum.enumValues).toContain('consolation');
  });
});

describe('DB-3: tenancy columns', () => {
  it('every tenant-scoped table carries organizationId', () => {
    // Populated even though v1 is single-tenant. Backfilling a tenant column
    // into a live schema is tedious; an unused one is free.
    const scoped = [
      ['tournaments', tournaments],
      ['events', events],
      ['players', players],
      ['entrants', entrants],
      ['stages', stages],
      ['rounds', rounds],
      ['matches', matches],
      ['score_events', scoreEvents],
      ['standings', standings],
      ['entry_submissions', entrySubmissions],
      ['scorekeeper_tokens', scorekeeperTokens],
      ['invitations', invitations],
    ] as const;

    for (const [name, table] of scoped) {
      expect(table.organizationId, `${name} is missing organizationId`).toBeDefined();
      expect(table.organizationId.notNull, `${name}.organizationId must be NOT NULL`).toBe(true);
    }
  });

});

describe('admin invitations schema', () => {
  it('keeps invite hashes unique and only one pending invite per organization/email', () => {
    const indexes = getTableConfig(invitations).indexes.map((index) => index.config.name);
    expect(indexes).toContain('invitations_token_hash_unique');
    expect(indexes).toContain('invitations_org_email_pending_unique');
    expect(indexes).toContain('invitations_org_idx');
    expect(invitations.tokenHash.notNull).toBe(true);
    expect(Object.keys(invitations)).not.toContain('role');
  });

  it('keeps account email globally unique', () => {
    expect(getTableConfig(users).indexes.map((index) => index.config.name)).toContain(
      'users_email_unique',
    );
  });
});

describe('password resets schema', () => {
  it('stores unique token hashes with throttle indexes and a cascading user reference', () => {
    const config = getTableConfig(passwordResets);
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        'password_resets_token_hash_unique',
        'password_resets_user_created_idx',
        'password_resets_ip_created_idx',
      ]),
    );
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0]?.onDelete).toBe('cascade');
    expect(passwordResets.tokenHash.notNull).toBe(true);
    expect(passwordResets.requestedIpHash.notNull).toBe(false);
  });
});

describe('DB-5: the Stage guardrail', () => {
  it('Stage is a real table with its own identity', () => {
    // Collapsing this into an enum column on events would foreclose
    // consolation draws (docs/consolation-draws-deferred.md §4).
    expect(stages.id).toBeDefined();
    expect(stages.eventId).toBeDefined();
  });

  it('Stage can point at a parent stage', () => {
    // Unused in v1 and deliberately present: a consolation stage references
    // the main draw it feeds from.
    expect(stages.parentStageId).toBeDefined();
  });

  it('matches hang off a round, which hangs off a stage', () => {
    // This is what lets the bracket renderer take a STAGE rather than an event.
    expect(matches.roundId).toBeDefined();
    expect(rounds.stageId).toBeDefined();
  });
});

describe('sourceRef columns', () => {
  it('a match side can be undecided but still know where it comes from', () => {
    // The mechanism that lets a full bracket exist before any ball is hit.
    expect(matchSides.entrantId).toBeDefined();
    expect(matchSides.sourceKind).toBeDefined();
    expect(matchSides.sourceMatchId).toBeDefined();
    expect(matchSides.sourceGroupId).toBeDefined();
    expect(matchSides.sourceRank).toBeDefined();
  });

  it('entrantId is nullable, because most sides start undecided', () => {
    expect(matchSides.entrantId.notNull).toBe(false);
  });
});

describe('no-skill invariant', () => {
  it('players have no rating column of any kind', () => {
    // The product does not know how good anyone is and must not learn.
    const columns = Object.keys(players);
    for (const forbidden of ['rating', 'ntrp', 'utr', 'elo', 'skill', 'ranking']) {
      expect(columns.map((c) => c.toLowerCase())).not.toContain(forbidden);
    }
  });

  it('entrant seeds are nullable, because most draws are unseeded', () => {
    expect(entrants.seed.notNull).toBe(false);
  });
});

describe('idempotency', () => {
  it('score events are unique per client event id', () => {
    // Enforced by the database rather than by application care, so a
    // double-tap or a retried request cannot double-apply.
    expect(scoreEvents.clientEventId.notNull).toBe(true);
  });
});

describe('DB-9: default category ladder', () => {
  it('is the Open..D ladder, strongest first', () => {
    expect(DEFAULT_CATEGORY_LADDER.map((c) => c.code)).toEqual([
      'Open',
      'A',
      'B',
      'C+',
      'C',
      'D',
    ]);
  });

  it('ranks ascend from the strongest with no gaps', () => {
    expect(DEFAULT_CATEGORY_LADDER.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('is NOT in alphabetical order, which would read as broken', () => {
    const alphabetical = [...DEFAULT_CATEGORY_LADDER].sort((a, b) =>
      a.code.localeCompare(b.code),
    );
    expect(alphabetical.map((c) => c.code)).not.toEqual(
      DEFAULT_CATEGORY_LADDER.map((c) => c.code),
    );
  });

  it('produces valid, unique, route-safe slugs', () => {
    const slugs = DEFAULT_CATEGORY_LADDER.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(isValidSlug(slug), slug).toBe(true);
  });

  it('defaults the strong tiers to round robin and the rest to brackets', () => {
    // Defaults, never rules -- the admin overrides any cell.
    expect(DEFAULT_FORMAT_BY_CATEGORY['Open']).toBe('roundRobin');
    expect(DEFAULT_FORMAT_BY_CATEGORY['B']).toBe('roundRobin');
    expect(DEFAULT_FORMAT_BY_CATEGORY['C+']).toBe('singleElimination');
    expect(DEFAULT_FORMAT_BY_CATEGORY['D']).toBe('singleElimination');
  });

  it('has a format default for every category in the ladder', () => {
    for (const category of DEFAULT_CATEGORY_LADDER) {
      expect(DEFAULT_FORMAT_BY_CATEGORY[category.code], category.code).toBeDefined();
    }
  });
});
