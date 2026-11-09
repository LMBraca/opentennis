import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, count } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { deleteUpdateAction, toggleUpdateAction } from './update-actions';
import { PageHeader, PageBody } from '@/components/page-header';
import { ConfirmAction } from '@/components/confirm-action';
import { dictionary } from '@/lib/i18n/dictionaries';
import { currentLocale } from '@/lib/i18n/server';
import { venueArticleDateFormatter } from '@/lib/venue-time';
import styles from '../admin.module.css';

export const metadata: Metadata = { title: 'Updates · Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminUpdates() {
  await requireUser('/admin/updates');
  const dict = dictionary(await currentLocale());
  const articleDate = venueArticleDateFormatter('en-GB');

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
        /*
         * The route /admin/updates/new existed, with a full editor behind
         * it, and nothing on this page linked to it — the only way to
         * write an update was to know the URL.
         */
        actions={
          <Link className={styles.headerAction} href="/admin/updates/new">
            Write an update
          </Link>
        }
      />

      <PageBody>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            No updates yet. <Link href="/admin/updates/new">Write the first one.</Link>
          </p>
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
                            {articleDate.format(u.publishedAt)}
                          </span>
                        )}
                        {u.mediaCount > 0 && <span>{u.mediaCount} photos</span>}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <Link className={styles.action} href={`/admin/updates/${u.id}`}>
                        Edit
                      </Link>
                      <ConfirmAction
                        action={toggleUpdateAction}
                        fields={{ id: u.id }}
                        title={live ? dict.confirmUnpublishUpdateTitle : dict.confirmPublishUpdateTitle}
                        body={live ? dict.confirmUnpublishUpdateBody : dict.confirmPublishUpdateBody}
                        label={live ? 'Unpublish' : 'Publish'}
                        cancelLabel={dict.cancel}
                        className={styles.actionGhost}
                      />
                      {live && (
                        <Link className={styles.actionGhost} href={`/updates/${u.slug}`}>
                          View
                        </Link>
                      )}
                      <ConfirmAction
                        action={deleteUpdateAction}
                        fields={{ id: u.id }}
                        title={dict.confirmDeleteUpdateTitle}
                        body={dict.confirmDeleteUpdateBody}
                        label="Delete"
                        cancelLabel={dict.cancel}
                        className={styles.actionGhost}
                      />
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
