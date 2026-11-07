'use server';

/**
 * Admin write actions for club updates.
 *
 * Every action re-checks the session. A server action is a public HTTP
 * endpoint with a generated name, not a private function — treating one as
 * trusted because the only link to it sits behind a login is how these get
 * exploited.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { schema, nextAvailableSlug, slugify } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import { internalTournamentSlugs, invalidTournamentLinks } from '@/lib/markdown';
import { publicTournamentPaths } from '@/lib/queries';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';

export interface UpdateFormState {
  readonly error?: string;
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function nullable(form: FormData, key: string): string | null {
  const value = text(form, key);
  return value === '' ? null : value;
}

async function invalidPublishedLinkError(body: string): Promise<string | null> {
  const slugs = internalTournamentSlugs(body);
  const [path] = invalidTournamentLinks(body, await publicTournamentPaths(slugs));
  if (path === undefined) return null;
  return fill(dictionary(await currentLocale()).invalidTournamentLink, { path });
}

/** Slugs must be unique across the whole table, so the check is unscoped. */
async function uniqueSlug(desired: string, excludeId?: string): Promise<string> {
  const taken = await db()
    .select({ slug: schema.updates.slug, id: schema.updates.id })
    .from(schema.updates);

  const used = new Set(
    taken.filter((r) => r.id !== excludeId).map((r) => r.slug),
  );
  return nextAvailableSlug(desired, (s) => used.has(s));
}

/**
 * Parse the media textarea.
 *
 * One item per line, `url | alt | caption`. A repeating fieldset with add and
 * remove buttons would be nicer, but this is honest about what it is and an
 * organizer can paste twenty URLs from their phone in one go — which is the
 * actual workflow after a finals day.
 */
function parseMedia(raw: string): { url: string; alt: string; caption: string | null }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [url = '', alt = '', caption = ''] = line.split('|').map((p) => p.trim());
      return { url, alt, caption: caption === '' ? null : caption };
    })
    .filter((item) => /^https?:\/\//i.test(item.url) || item.url.startsWith('/'));
}

async function writeMedia(updateId: string, raw: string): Promise<void> {
  const items = parseMedia(raw);

  // Replace wholesale rather than diff. The list is small, ordering is
  // positional, and a diff would have to answer "is this the same photo with
  // a new caption, or a different photo?" with no stable id in the textarea.
  await db().delete(schema.mediaItems).where(eq(schema.mediaItems.updateId, updateId));
  if (items.length === 0) return;

  await db()
    .insert(schema.mediaItems)
    .values(
      items.map((item, i) => ({
        organizationId: orgId(),
        updateId,
        url: item.url,
        alt: item.alt,
        caption: item.caption,
        position: i,
      })),
    );
}

export async function createUpdateAction(
  _prev: UpdateFormState,
  form: FormData,
): Promise<UpdateFormState> {
  await requireCapability('content:manage', '/admin/updates');

  const title = text(form, 'title');
  if (title === '') return { error: 'Give the update a title.' };

  const publish = form.get('publish') === 'on';
  if (publish) {
    const linkError = await invalidPublishedLinkError(text(form, 'body'));
    if (linkError !== null) return { error: linkError };
  }
  const slug = await uniqueSlug(slugify(title));

  const rows = await db()
    .insert(schema.updates)
    .values({
      organizationId: orgId(),
      slug,
      title,
      excerpt: nullable(form, 'excerpt'),
      body: text(form, 'body'),
      coverUrl: nullable(form, 'coverUrl'),
      coverAlt: nullable(form, 'coverAlt'),
      tournamentId: nullable(form, 'tournamentId'),
      visibility: publish ? 'public' : 'draft',
      publishedAt: publish ? new Date() : null,
    })
    .returning({ id: schema.updates.id });

  const created = rows[0];
  if (created === undefined) return { error: 'Could not save the update.' };

  await writeMedia(created.id, text(form, 'media'));

  revalidatePath('/admin/updates');
  revalidatePath('/updates');
  revalidatePath('/media');
  revalidatePath('/');
  redirect('/admin/updates');
}

export async function saveUpdateAction(
  _prev: UpdateFormState,
  form: FormData,
): Promise<UpdateFormState> {
  await requireCapability('content:manage', '/admin/updates');

  const id = text(form, 'id');
  const title = text(form, 'title');
  if (id === '') return { error: 'Missing update id.' };
  if (title === '') return { error: 'Give the update a title.' };

  const existing = await db()
    .select({
      id: schema.updates.id,
      slug: schema.updates.slug,
      title: schema.updates.title,
      publishedAt: schema.updates.publishedAt,
    })
    .from(schema.updates)
    .where(and(eq(schema.updates.id, id), eq(schema.updates.organizationId, orgId())))
    .limit(1);

  const row = existing[0];
  if (row === undefined) return { error: 'That update no longer exists.' };

  const publish = form.get('publish') === 'on';
  if (publish) {
    const linkError = await invalidPublishedLinkError(text(form, 'body'));
    if (linkError !== null) return { error: linkError };
  }

  // The slug only follows the title while the post is unpublished. Once it is
  // live the URL has been shared, and silently moving it breaks every link.
  const slug =
    row.publishedAt === null && title !== row.title
      ? await uniqueSlug(slugify(title), row.id)
      : row.slug;

  await db()
    .update(schema.updates)
    .set({
      slug,
      title,
      excerpt: nullable(form, 'excerpt'),
      body: text(form, 'body'),
      coverUrl: nullable(form, 'coverUrl'),
      coverAlt: nullable(form, 'coverAlt'),
      tournamentId: nullable(form, 'tournamentId'),
      visibility: publish ? 'public' : 'draft',
      // Keep the ORIGINAL publication date on re-publish. Editing a typo
      // must not bump a six-month-old post back to the top of the feed.
      publishedAt: publish ? (row.publishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.updates.id, row.id));

  await writeMedia(row.id, text(form, 'media'));

  revalidatePath('/admin/updates');
  revalidatePath('/updates');
  revalidatePath(`/updates/${slug}`);
  revalidatePath('/media');
  revalidatePath('/');
  redirect('/admin/updates');
}

export async function deleteUpdateAction(formData: FormData): Promise<void> {
  await requireCapability('content:manage', '/admin/updates');
  const id = String(formData.get('id') ?? '');
  if (id === '') return;

  // Scoped to the organization: an id from another tenant must not delete.
  // media_items cascades on the foreign key.
  await db()
    .delete(schema.updates)
    .where(and(eq(schema.updates.id, id), eq(schema.updates.organizationId, orgId())));

  revalidatePath('/admin/updates');
  revalidatePath('/updates');
  revalidatePath('/media');
  revalidatePath('/');
}

/** Publish / unpublish from the list, without opening the editor. */
export async function toggleUpdateAction(formData: FormData): Promise<void> {
  await requireCapability('content:manage', '/admin/updates');
  const id = String(formData.get('id') ?? '');
  if (id === '') return;

  const [update] = await db()
    .select({ body: schema.updates.body, visibility: schema.updates.visibility })
    .from(schema.updates)
    .where(and(eq(schema.updates.id, id), eq(schema.updates.organizationId, orgId())))
    .limit(1);
  if (update === undefined) return;
  if (update.visibility !== 'public') {
    const linkError = await invalidPublishedLinkError(update.body);
    if (linkError !== null) return;
  }

  await db()
    .update(schema.updates)
    .set({
      visibility: sql`case when ${schema.updates.visibility} = 'public' then 'draft'::visibility else 'public'::visibility end`,
      publishedAt: sql`case when ${schema.updates.visibility} = 'public' then null else coalesce(${schema.updates.publishedAt}, now()) end`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.updates.id, id),
        eq(schema.updates.organizationId, orgId()),
        inArray(schema.updates.visibility, ['draft', 'public', 'unlisted']),
      ),
    );

  revalidatePath('/admin/updates');
  revalidatePath('/updates');
  revalidatePath('/media');
  revalidatePath('/');
}
