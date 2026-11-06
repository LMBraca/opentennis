/**
 * ADM-3 — the category ladder editor.
 *
 * One list, ordered strongest to weakest, which is the order it appears in
 * everywhere else: the admin grid's rows, the entry form's dropdown, the
 * draw switcher. Rank IS the ladder, so reordering here reorders the
 * product.
 */

import type { Metadata } from 'next';
import { asc, count, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import { PageHeader, PageBody } from '@/components/page-header';
import { LadderEditor, type LadderRow } from './ladder-editor';
import adminStyles from '../admin.module.css';
import styles from './categories.module.css';

export const metadata: Metadata = { title: 'Categories · Admin' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  await requireCapability('content:manage', '/admin/categories');
  const organizationId = orgId();

  const categories = await db()
    .select({
      id: schema.categories.id,
      code: schema.categories.code,
      slug: schema.categories.slug,
      rank: schema.categories.rank,
    })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, organizationId))
    .orderBy(asc(schema.categories.rank));

  const usage = await db()
    .select({ categoryId: schema.events.categoryId, n: count(schema.events.id) })
    .from(schema.events)
    .groupBy(schema.events.categoryId);
  const usedBy = new Map(usage.map((u) => [u.categoryId, u.n]));

  const rows: LadderRow[] = categories.map((c, index) => ({
    id: c.id,
    code: c.code,
    slug: c.slug,
    draws: usedBy.get(c.id) ?? 0,
    isFirst: index === 0,
    isLast: index === categories.length - 1,
  }));

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin', label: 'Back to tournaments' }}
        title="Categories"
        lead="The club's ladder, strongest first. Every tournament draws its categories from this list."
        facts={[{ value: rows.length, label: rows.length === 1 ? 'category' : 'categories' }]}
      />
      <PageBody>
        <LadderEditor rows={rows} />
        <p className={styles.note}>
          Renaming a category changes how it reads everywhere, but not its web address —
          printed QR codes keep working.
        </p>
      </PageBody>
    </main>
  );
}
