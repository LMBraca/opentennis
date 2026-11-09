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
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: dict.categories };
}

export default async function CategoriesPage() {
  await requireCapability('content:manage', '/admin/categories');
  const organizationId = orgId();
  const dict = dictionary(await currentLocale());

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
        back={{ href: '/admin', label: dict.backToTournaments }}
        title={dict.categories}
        lead={dict.categoryLadderLead}
        facts={[
          {
            value: rows.length,
            label: rows.length === 1 ? dict.categoryUnit : dict.categories,
          },
        ]}
      />
      <PageBody>
        <LadderEditor rows={rows} dict={dict} />
        <p className={styles.note}>{dict.categoryRenamingNote}</p>
      </PageBody>
    </main>
  );
}
