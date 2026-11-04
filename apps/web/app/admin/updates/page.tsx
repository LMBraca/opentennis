import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, count } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { deleteUpdateAction, toggleUpdateAction } from './update-actions';
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
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <p className={styles.club}>Open Tennis · Admin</p>
            <Link href="/admin" className={styles.signOut}>
              ← Tournaments
            </Link>
          </div>
          <h1 className={styles.title}>Updates</h1>
          <p className={styles.who}>News, results and announcements for the public site.</p>
          <Link href="/admin/updates/new" className={styles.newButton}>
            + New update
          </Link>
        </div>
      </header>

      <div className={styles.content}>
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
                        {live ? 'Published' : 'Draft'}
                        {u.publishedAt !== null &&
                          ` · ${new Intl.DateTimeFormat('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'UTC',
                          }).format(u.publishedAt)}`}
                        {u.mediaCount > 0 && ` · ${u.mediaCount} photos`}
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
      </div>
    </main>
  );
}
