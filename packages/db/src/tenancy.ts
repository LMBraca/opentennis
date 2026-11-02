/**
 * DB-3 GUARDRAIL: tenancy enforced at the data-access layer.
 *
 * A missing `where organizationId = ?` is the standard multi-tenant data leak,
 * and retroactively auditing every call site across a codebase is how that bug
 * ships. So the filter is not something a caller remembers — it is something a
 * caller cannot omit.
 *
 * The mechanism: queries go through a `TenantScope` that already holds the
 * organization id and supplies the predicate. v1 serves a single organization,
 * so this is currently a no-op in practice. It is written now because the
 * discipline is free today and expensive later.
 *
 * Deliberately NOT relying on Postgres row-level security: the app connects as
 * one role over a serverless pool, so there is no per-request database session
 * to attach a policy to. Enforcement has to live in the query builder.
 */

import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** Any table that is tenant-scoped exposes this column. */
export interface TenantScoped {
  readonly organizationId: PgColumn;
}

export class TenantScope {
  readonly organizationId: string;

  constructor(organizationId: string) {
    if (organizationId.trim() === '') {
      // An empty scope would silently widen every query to the whole table,
      // which is precisely the failure this class exists to prevent.
      throw new Error('TenantScope requires a non-empty organizationId');
    }
    this.organizationId = organizationId;
  }

  /**
   * The tenant predicate for a table, optionally combined with more conditions.
   *
   * Always put the tenant filter FIRST in the `and(...)`, so that reading a
   * query makes the scoping obvious at a glance rather than buried among
   * business predicates.
   */
  where<T extends TenantScoped>(table: T, ...conditions: Array<SQL | undefined>): SQL {
    const tenant = eq(table.organizationId, this.organizationId);
    const extra = conditions.filter((c): c is SQL => c !== undefined);
    if (extra.length === 0) return tenant;
    return and(tenant, ...extra) as SQL;
  }

  /** Spread into an insert so a row cannot be created outside its tenant. */
  get insertScope(): { organizationId: string } {
    return { organizationId: this.organizationId };
  }

  /**
   * Guard for rows fetched by primary key, where the tenant filter cannot be
   * expressed in the query itself. Returns the row or null — never a row from
   * another tenant.
   */
  assertOwned<T extends { organizationId: string }>(row: T | null | undefined): T | null {
    if (row === null || row === undefined) return null;
    if (row.organizationId !== this.organizationId) return null;
    return row;
  }

  /** Filter a fetched collection down to this tenant. */
  ownedOnly<T extends { organizationId: string }>(rows: readonly T[]): T[] {
    return rows.filter((r) => r.organizationId === this.organizationId);
  }
}

/**
 * v1 runs single-tenant, with the organization seeded at deploy and its id in
 * config. This is the only place that fact is encoded, so going multi-tenant
 * means changing how a scope is obtained — not changing any query.
 */
export function scopeFromEnv(env: Record<string, string | undefined> = process.env): TenantScope {
  const organizationId = env['OPENTENNIS_ORG_ID'];
  if (organizationId === undefined || organizationId.trim() === '') {
    throw new Error(
      'OPENTENNIS_ORG_ID is not set. v1 is single-tenant and needs the seeded organization id.',
    );
  }
  return new TenantScope(organizationId);
}
