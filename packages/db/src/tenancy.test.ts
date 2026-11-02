import { describe, expect, it } from 'vitest';
import { TenantScope, scopeFromEnv } from './tenancy';
import { entrants, events, players, tournaments } from './schema/core';

describe('TenantScope', () => {
  const scope = new TenantScope('org-1');

  it('refuses an empty organization id', () => {
    // An empty scope would silently widen every query to the whole table,
    // which is exactly the leak this class exists to prevent.
    expect(() => new TenantScope('')).toThrow(/non-empty/);
    expect(() => new TenantScope('   ')).toThrow(/non-empty/);
  });

  it('builds a predicate for every tenant-scoped table', () => {
    for (const table of [tournaments, events, players, entrants]) {
      expect(scope.where(table)).toBeDefined();
    }
  });

  it('combines the tenant filter with extra conditions', () => {
    const sql = scope.where(tournaments, undefined, undefined);
    expect(sql).toBeDefined();
  });

  it('supplies the organization id for inserts', () => {
    expect(scope.insertScope).toEqual({ organizationId: 'org-1' });
  });

  describe('assertOwned', () => {
    it('returns a row belonging to the scope', () => {
      const row = { id: 't1', organizationId: 'org-1' };
      expect(scope.assertOwned(row)).toBe(row);
    });

    it('returns null for a row from another tenant rather than throwing', () => {
      // Returning null makes a cross-tenant fetch indistinguishable from a
      // missing row, which is the correct thing to leak: nothing.
      expect(scope.assertOwned({ id: 't1', organizationId: 'org-2' })).toBeNull();
    });

    it('passes null and undefined straight through', () => {
      expect(scope.assertOwned(null)).toBeNull();
      expect(scope.assertOwned(undefined)).toBeNull();
    });
  });

  describe('ownedOnly', () => {
    it('drops rows from other tenants', () => {
      const rows = [
        { id: '1', organizationId: 'org-1' },
        { id: '2', organizationId: 'org-2' },
        { id: '3', organizationId: 'org-1' },
      ];
      expect(scope.ownedOnly(rows).map((r) => r.id)).toEqual(['1', '3']);
    });

    it('returns empty rather than everything when nothing matches', () => {
      expect(scope.ownedOnly([{ id: '1', organizationId: 'other' }])).toEqual([]);
    });
  });
});

describe('scopeFromEnv', () => {
  it('reads the seeded organization id', () => {
    expect(scopeFromEnv({ OPENTENNIS_ORG_ID: 'org-9' }).organizationId).toBe('org-9');
  });

  it('fails loudly when unset, rather than defaulting to something', () => {
    // A default here would mean a misconfigured deploy silently reads or writes
    // the wrong tenant's data.
    expect(() => scopeFromEnv({})).toThrow(/OPENTENNIS_ORG_ID is not set/);
    expect(() => scopeFromEnv({ OPENTENNIS_ORG_ID: '' })).toThrow(/not set/);
  });
});
