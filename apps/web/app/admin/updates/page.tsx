import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, count } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { deleteUpdateAction, toggleUpdateAction } from './update-actions';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from '../admin.module.css';

export const metadata: Metadata = { title: 'Updates · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminUpdates() {
  await requireUser('/admin/updates');

  // Admin sees DRAFTS too — unlike the public queries, which filter them out.
  // A dashboard that hides your own unpublished work is useless.
  const rows = await db()
    .select({
      id: schema.updates.id,
      slug: schema.updates.slug,
      title: schema.updates.title,
      visibility: schema.updates.visibility,
      publishedAt: schema.updates.publishedAt,
      updatedAt: schema.updates.updatedAt,
      mediaCount: count(schema.mediaItems.id),
    })
    .from(schema.updates)
    .leftJoin(schema.mediaItems, eq(schema.mediaItems.updateId, schema.updates.id))
    .where(eq(schema.updates.organizationId, orgId()))
    .groupBy(schema.updates.id)
    .orderBy(desc(schema.updates.updatedAt));

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin', label: 'Back to tournaments' }}
        title="Updates"
        lead="News, results and announcements for the public site."
      />

      <PageBody>
        {rows.length === 0 ? (
          <p className={styles.empty}>No updates yet.</p>
        ) : (
          <ul className={styles.list}>
            {rows.map((u) => {
              const live = u.visibility === 'public' && u.publishedAt !== null;
              return (
                <li key={u.id}>
                  <div className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowName}>{u.title}</span>
                      <span className={styles.rowMeta}>
                        <span>{live ? 'Published' : 'Draft'}</span>
                        {u.publishedAt !== null && (
                          <span>
                            {new Intl.DateTimeFormat('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              timeZone: 'UTC',
                            }).format(u.publishedAt)}
                          </span>
                        )}
                        {u.mediaCount > 0 && <span>{u.mediaCount} photos</span>}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <Link className={styles.action} href={`/admin/updates/${u.id}`}>
                        Edit
                      </Link>
                      <form action={toggleUpdateAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className={styles.actionGhost} type="submit">
                          {live ? 'Unpublish' : 'Publish'}
                        </button>
                      </form>
                      {live && (
                        <Link className={styles.actionGhost} href={`/updates/${u.slug}`}>
                          View
                        </Link>
                      )}
                      <form action={deleteUpdateAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className={styles.actionGhost} type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </main>
  );
}
