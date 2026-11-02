/**
 * Database health check.
 *
 * Proves the full path end to end: pooled connection → Drizzle → real tables
 * seeded with real rows. Deliberately queries the category ladder rather than
 * running `SELECT 1`, because `SELECT 1` succeeds against an empty database
 * and would pass while the schema was missing.
 */

import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';

// Never prerendered or cached: a health check that returns a build-time
// snapshot tells you nothing about the running system.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    const organizationId = orgId();

    const organizations = await db()
      .select({ id: schema.organizations.id, name: schema.organizations.name })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1);

    const organization = organizations[0];
    if (organization === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: `No organization ${organizationId}. Has the seed script run?`,
        },
        { status: 503 },
      );
    }

    const categories = await db()
      .select({ code: schema.categories.code, rank: schema.categories.rank })
      .from(schema.categories)
      .where(eq(schema.categories.organizationId, organizationId))
      .orderBy(asc(schema.categories.rank));

    return NextResponse.json({
      ok: true,
      service: 'postgres',
      branch: process.env['NEON_BRANCH'] ?? null,
      // Pooled connections carry the -pooler suffix. Surfaced so a
      // misconfiguration is visible rather than silently slow.
      pooled: (process.env['DATABASE_URL'] ?? '').includes('-pooler'),
      organization: organization.name,
      categories: categories.map((c) => c.code),
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'postgres',
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
