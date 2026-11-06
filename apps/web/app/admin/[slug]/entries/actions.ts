'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import { acceptSubmission, markReviewed } from '@/lib/accept-entry';

export interface QueueState {
  readonly error?: string;
  readonly accepted?: number;
}

/** Ids this organization actually owns, so a posted id cannot reach across tenants. */
async function ownedIds(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db()
    .select({ id: schema.entrySubmissions.id })
    .from(schema.entrySubmissions)
    .where(
      and(
        inArray(schema.entrySubmissions.id, [...ids]),
        eq(schema.entrySubmissions.organizationId, orgId()),
      ),
    );
  return rows.map((r) => r.id);
}

export async function acceptEntries(_prev: QueueState, form: FormData): Promise<QueueState> {
  const user = await requireCapability('entrants:write', '/admin');
  const slug = String(form.get('slug') ?? '');
  const ids = await ownedIds(form.getAll('id').map(String));
  if (ids.length === 0) return { error: 'Nothing selected.' };

  let accepted = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const result = await acceptSubmission(id, user.id);
    if (result.error === undefined) accepted += 1;
    else failures.push(result.error);
  }

  revalidatePath(`/admin/${slug}/entries`);
  revalidatePath(`/admin/${slug}`);

  // Report partial success honestly rather than claiming the whole batch
  // landed: with a bulk accept, "4 of 6" is the useful sentence.
  if (failures.length > 0) {
    return {
      accepted,
      error: `${accepted} accepted, ${failures.length} could not be: ${[...new Set(failures)].join(' ')}`,
    };
  }
  return { accepted };
}

export async function rejectEntries(_prev: QueueState, form: FormData): Promise<QueueState> {
  const user = await requireCapability('entrants:write', '/admin');
  const slug = String(form.get('slug') ?? '');
  const reason = String(form.get('reason') ?? '').trim();
  const ids = await ownedIds(form.getAll('id').map(String));
  if (ids.length === 0) return { error: 'Nothing selected.' };

  for (const id of ids) {
    await markReviewed(id, 'rejected', user.id, reason === '' ? undefined : reason);
  }
  revalidatePath(`/admin/${slug}/entries`);
  return { accepted: 0 };
}

/** Switch review on or off for this tournament. */
export async function setReviewEntries(form: FormData): Promise<void> {
  await requireCapability('entrants:write', '/admin');
  const slug = String(form.get('slug') ?? '');
  const on = form.get('on') === 'true';
  await db()
    .update(schema.tournaments)
    .set({ reviewEntries: on })
    .where(
      and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)),
    );
  revalidatePath(`/admin/${slug}/entries`);
  revalidatePath(`/admin/${slug}`);
}
