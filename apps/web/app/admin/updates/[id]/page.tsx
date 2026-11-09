import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { saveUpdateAction } from '../update-actions';
import { renderMarkdown } from '@/lib/markdown';
import { UpdateForm } from '../update-form';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from '../../admin.module.css';

export const metadata: Metadata = { title: 'Edit update · Admin' };
export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ id: string }>;
}

export default async function EditUpdate({ params }: Params) {
  const { id } = await params;
  await requireUser(`/admin/updates/${id}`);

  const rows = await db()
    .select()
    .from(schema.updates)
    .where(and(eq(schema.updates.id, id), eq(schema.updates.organizationId, orgId())))
    .limit(1);

  const update = rows[0];
  if (update === undefined) notFound();

  const [media, tournaments] = await Promise.all([
    db()
      .select({
        url: schema.mediaItems.url,
        alt: schema.mediaItems.alt,
        caption: schema.mediaItems.caption,
      })
      .from(schema.mediaItems)
      .where(eq(schema.mediaItems.updateId, update.id))
      .orderBy(asc(schema.mediaItems.position)),
    db()
      .select({ id: schema.tournaments.id, name: schema.tournaments.name })
      .from(schema.tournaments)
      .where(eq(schema.tournaments.organizationId, orgId()))
      .orderBy(asc(schema.tournaments.startDate)),
  ]);

  // Back to the same `url | alt | caption` lines the form parses, so a
  // round-trip through the editor changes nothing it did not have to.
  const mediaText = media
    .map((m) => [m.url, m.alt, m.caption ?? ''].join(' | ').replace(/\s*\|\s*$/, ''))
    .join('\n');

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin/updates', label: 'Back to updates' }}
        title="Edit update"
        lead={`/blog/${update.slug}`}
      />
      <PageBody>
        <UpdateForm
          action={saveUpdateAction}
          tournaments={tournaments}
          submitLabel="Save changes"
          initial={{
            id: update.id,
            title: update.title,
            excerpt: update.excerpt ?? '',
            body: update.body,
            /* RV-15: rendered on the server with the same function the
               public page uses, so the editor opens on exactly what a
               reader would see. */
            bodyHtml: renderMarkdown(update.body),
            coverUrl: update.coverUrl ?? '',
            coverAlt: update.coverAlt ?? '',
            tournamentId: update.tournamentId ?? '',
            media: mediaText,
            published: update.visibility === 'public' && update.publishedAt !== null,
          }}
        />
      </PageBody>
    </main>
  );
}
