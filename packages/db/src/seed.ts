/**
 * DB-9: seed a single organization with the default category ladder.
 *
 * Run once per environment:
 *
 *   DATABASE_URL=... pnpm --filter @opentennis/db exec tsx src/seed.ts "Riverside Tennis Club"
 *
 * It prints the organization id, which goes into OPENTENNIS_ORG_ID. v1 is
 * single-tenant and that env var is the only place the fact is encoded, so
 * going multi-tenant later means changing how a scope is obtained rather than
 * changing any query (see tenancy.ts).
 *
 * Idempotent: re-running with the same name updates the ladder in place rather
 * than creating a second organization.
 */

import { eq } from 'drizzle-orm';
import { createDb } from './client';
import { categories, organizations } from './schema/core';
import { DEFAULT_CATEGORY_LADDER } from './seed-data';
import { slugify } from './slugs';

export async function seedOrganization(
  connectionString: string,
  name: string,
): Promise<{ organizationId: string; created: boolean }> {
  const db = createDb(connectionString);
  const slug = slugify(name);

  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  const found = existing[0];
  const organizationId =
    found?.id ??
    (
      await db
        .insert(organizations)
        .values({ name, slug })
        .returning({ id: organizations.id })
    )[0]?.id;

  if (organizationId === undefined) {
    throw new Error('Failed to create organization');
  }

  // Upsert the ladder. Codes are stable identifiers, so a re-run adjusts rank
  // and label without orphaning any event that already references a category.
  for (const category of DEFAULT_CATEGORY_LADDER) {
    await db
      .insert(categories)
      .values({
        organizationId,
        code: category.code,
        slug: category.slug,
        label: category.label,
        rank: category.rank,
      })
      .onConflictDoUpdate({
        target: [categories.organizationId, categories.code],
        set: { rank: category.rank, label: category.label, slug: category.slug },
      });
  }

  return { organizationId, created: found === undefined };
}

/* c8 ignore start -- CLI entry point */
if (process.argv[1]?.endsWith('seed.ts') === true) {
  const url = process.env['DATABASE_URL'];
  const name = process.argv[2] ?? 'My Tennis Club';

  if (url === undefined || url.trim() === '') {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  seedOrganization(url, name)
    .then(({ organizationId, created }) => {
      console.log(`${created ? 'Created' : 'Updated'} organization "${name}"`);
      console.log(`${DEFAULT_CATEGORY_LADDER.length} categories seeded.`);
      console.log('');
      console.log('Add this to .env.local:');
      console.log(`OPENTENNIS_ORG_ID="${organizationId}"`);
    })
    .catch((error: unknown) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
/* c8 ignore stop */
