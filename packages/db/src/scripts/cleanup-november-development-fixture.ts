import { and, eq } from 'drizzle-orm';
import { createDb, schema } from '../client';
import { cleanNovemberFixtureContent } from '../dev-fixture-content';

const ARTICLE_SLUG = 'finales-de-noviembre-hernandez-se-lleva-c';
const DEVELOPMENT_HOST_PREFIX = 'ep-old-meadow-aksdequf.';

async function main(): Promise<void> {
  if (process.env['NEON_BRANCH'] !== 'development') {
    throw new Error('NEON_BRANCH must be "development" to clean this fixture');
  }
  if (!process.argv.includes('--confirm-development-fixture-cleanup')) {
    throw new Error('Pass --confirm-development-fixture-cleanup to continue');
  }

  const url = process.env['DATABASE_URL_UNPOOLED'];
  const organizationId = process.env['OPENTENNIS_ORG_ID'];
  if (url === undefined || url.trim() === '') {
    throw new Error('DATABASE_URL_UNPOOLED is not set');
  }
  if (organizationId === undefined || organizationId.trim() === '') {
    throw new Error('OPENTENNIS_ORG_ID is not set');
  }
  const host = new URL(url).hostname;
  if (!host.startsWith(DEVELOPMENT_HOST_PREFIX) || host.includes('-pooler')) {
    throw new Error('The direct database URL is not the configured development Neon branch');
  }

  const db = createDb(url);
  const removedCount = await db.transaction(async (tx) => {
    const [article] = await tx
      .select({
        id: schema.updates.id,
        body: schema.updates.body,
        excerpt: schema.updates.excerpt,
      })
      .from(schema.updates)
      .where(
        and(
          eq(schema.updates.organizationId, organizationId),
          eq(schema.updates.slug, ARTICLE_SLUG),
        ),
      )
      .limit(1);
    if (article === undefined) throw new Error(`Development article not found: ${ARTICLE_SLUG}`);

    const content = cleanNovemberFixtureContent(article);
    await tx
      .update(schema.updates)
      .set({ body: content.body, excerpt: content.excerpt, coverUrl: null, coverAlt: null })
      .where(eq(schema.updates.id, article.id));

    const removed = await tx
      .delete(schema.mediaItems)
      .where(
        and(
          eq(schema.mediaItems.organizationId, organizationId),
          eq(schema.mediaItems.updateId, article.id),
        ),
      )
      .returning({ id: schema.mediaItems.id });
    return removed.length;
  });

  console.log(`Cleaned the November development fixture; removed ${removedCount} gallery item(s).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
