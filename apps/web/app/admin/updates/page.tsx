import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, count } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@opentennis/db';
import { deleteUpdateAction, toggleUpdateAction } from './update-actions';
import { PageHeader, PageBody } from '@/components/page-header';
import { AdminNav } from '@/components/admin-nav';
import { AdminActions } from '@/components/admin-actions';
import { ConfirmAction } from '@/components/confirm-action';
import { venueArticleDateFormatter } from '@/lib/venue-time';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, intlLocale } from '@/lib/i18n/dictionaries';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: `${dict.updatesTitle} · ${dict.adminEyebrow}` };
}

export default async function AdminUpdates() {
  const user = await requireUser('/admin/updates');
  const locale = await currentLocale();
  const dict = dictionary(locale);
  // Was hardcoded 'en-GB', so these dates stayed English on a Spanish
  // admin. OT-22 leftover, found while adding the confirmations.
  const articleDate = venueArticleDateFormatter(intlLocale(locale));

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
        nav={
          <AdminNav
            dict={dict}
            canManageContent={can(user.role, 'content:manage')}
            canMergePlayers={can(user.role, 'players:merge')}
          />
        }
        title={dict.updatesTitle}
        lead="News, results and announcements for the public site."
        actions={<AdminActions dict={dict} />}
      />

      <PageBody>
        {/*
          The route /admin/updates/new existed with a full editor behind it
          and nothing linked to it — the only way to write a post was to
          know the URL. It is the same control, in the same place, with the
          same treatment as New tournament on /admin.
        */}
        <Link className={styles.pageAction} href="/admin/updates/new">
          {dict.writePost}
        </Link>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            Nothing posted yet. <Link href="/admin/updates/new">Write the first one.</Link>
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
                        {dict.edit}
                      </Link>
                      {/*
                        OT-19. Publishing and unpublishing both change what
                        the public can see in one click, and unpublishing
                        breaks links people already hold — so both ask, and
                        each says which of those two things is about to
                        happen.
                      */}
                      <ConfirmAction
                        action={toggleUpdateAction}
                        label={live ? dict.unpublish : dict.publish}
                        confirmLabel={live ? dict.unpublish : dict.publish}
                        consequence={
                          live ? dict.unpublishUpdateConsequence : dict.publishUpdateConsequence
                        }
                        cancelLabel={dict.cancel}
                        danger={live}
                        className={styles.actionGhost}
                      >
                        <input type="hidden" name="id" value={u.id} />
                      </ConfirmAction>
                      {live && (
                        <Link className={styles.actionGhost} href={`/blog/${u.slug}`}>
                          {dict.view}
                        </Link>
                      )}
                      <ConfirmAction
                        action={deleteUpdateAction}
                        label={dict.deleteLabel}
                        confirmLabel={dict.deleteLabel}
                        consequence={dict.deleteUpdateConsequence}
                        cancelLabel={dict.cancel}
                        danger
                        className={styles.actionGhost}
                      >
                        <input type="hidden" name="id" value={u.id} />
                      </ConfirmAction>
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
