'use server';

/**
 * ADM-3 — the category ladder.
 *
 * The ladder (Open, A, B, C+, C, D) was seeded and had no UI, so a club
 * that runs a "C-" or drops "A" had no way to say so. It is org-level, not
 * per-tournament: the same ladder every tournament draws from, which is why
 * renaming one here renames it everywhere and deleting one is refused while
 * any event still uses it.
 */

import { revalidatePath } from 'next/cache';
import { and, asc, count, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import {
  CATEGORY_LABEL_MAX,
  categoryLabelProblem,
  type CategoryLabelProblem,
} from '@/lib/category-label';

export interface LadderState {
  readonly ok?: string;
  readonly error?: string;
}

/*
 * OT-21. The refusals, as sentences.
 *
 * Still English, like the rest of this file's messages — `LadderState`
 * carries a sentence rather than a key, and converting the whole ladder
 * editor to the dictionary is OT-22 debt this ticket does not own. The
 * organizer should not reach these anyway: the input carries `maxLength`
 * and a live counter, so the limit is visible before it is hit, and these
 * are the server-side backstop.
 */
const LABEL_ERRORS: Record<CategoryLabelProblem, string> = {
  empty: 'Give the category a name.',
  tooLong: `A category name cannot be longer than ${CATEGORY_LABEL_MAX} characters.`,
  noAlphanumeric: 'That name has no letters or numbers in it.',
};

/** "C+" -> "c-plus". The slug is in URLs and on printed QR codes. */
function slugify(code: string): string {
  return code
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function addCategory(_prev: LadderState, form: FormData): Promise<LadderState> {
  await requireCapability('content:manage', '/admin/categories');
  const organizationId = orgId();
  /*
   * OT-21. Refuse an over-long name instead of truncating it.
   *
   * This was `.slice(0, 12)`, so "QA Test Category" was stored as "QA Test
   * Cate" and the organizer got a different name back than the one they
   * typed, with nothing saying why.
   */
  const code = String(form.get('code') ?? '').trim();
  const problem = categoryLabelProblem(code);
  if (problem !== null) return { error: LABEL_ERRORS[problem] };

  const slug = slugify(code);

  const [clash] = await db()
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(and(eq(schema.categories.organizationId, organizationId), eq(schema.categories.slug, slug)))
    .limit(1);
  if (clash !== undefined) return { error: `"${code}" already exists.` };

  const [last] = await db()
    .select({ rank: schema.categories.rank })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, organizationId))
    .orderBy(asc(schema.categories.rank));

  const ranks = await db()
    .select({ rank: schema.categories.rank })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, organizationId));
  const nextRank = ranks.reduce((max, r) => Math.max(max, r.rank), last?.rank ?? 0) + 1;

  await db().insert(schema.categories).values({
    organizationId,
    code,
    slug,
    rank: nextRank,
  });

  revalidatePath('/admin/categories');
  revalidatePath('/admin');
  return { ok: `Added ${code}.` };
}

export async function renameCategory(_prev: LadderState, form: FormData): Promise<LadderState> {
  await requireCapability('content:manage', '/admin/categories');
  const organizationId = orgId();
  const id = String(form.get('id') ?? '');
  const code = String(form.get('code') ?? '').trim();
  if (id === '') return { error: 'Give the category a name.' };
  // OT-21: same rules as adding one. A rename that silently shortened the
  // name was the reported case.
  const renameProblem = categoryLabelProblem(code);
  if (renameProblem !== null) return { error: LABEL_ERRORS[renameProblem] };

  /*
   * The CODE changes; the SLUG does not. `/t/:slug/:category/...` is printed
   * on QR codes and the spec promises those keep resolving for the life of
   * a tournament (PRD §4.4). Renaming "C+" to "C Plus" must not break a
   * poster on the clubhouse wall.
   */
  await db()
    .update(schema.categories)
    .set({ code, updatedAt: new Date() })
    .where(and(eq(schema.categories.organizationId, organizationId), eq(schema.categories.id, id)));

  revalidatePath('/admin/categories');
  revalidatePath('/', 'layout');
  return { ok: `Renamed to ${code}.` };
}

/** Move one step up or down the ladder by swapping ranks with its neighbour. */
export async function moveCategory(form: FormData): Promise<void> {
  await requireCapability('content:manage', '/admin/categories');
  const organizationId = orgId();
  const id = String(form.get('id') ?? '');
  const direction = String(form.get('direction') ?? '');
  if (id === '' || (direction !== 'up' && direction !== 'down')) return;

  const all = await db()
    .select({ id: schema.categories.id, rank: schema.categories.rank })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, organizationId))
    .orderBy(asc(schema.categories.rank));

  const index = all.findIndex((c) => c.id === id);
  const neighbourIndex = direction === 'up' ? index - 1 : index + 1;
  const me = all[index];
  const neighbour = all[neighbourIndex];
  if (me === undefined || neighbour === undefined) return;

  /*
   * Through a temporary rank, because (organization, rank) is unique and a
   * direct swap collides halfway through. -1 is safe: ranks are positive.
   */
  await db().transaction(async (tx) => {
    await tx.update(schema.categories).set({ rank: -1 }).where(eq(schema.categories.id, me.id));
    await tx
      .update(schema.categories)
      .set({ rank: me.rank })
      .where(eq(schema.categories.id, neighbour.id));
    await tx
      .update(schema.categories)
      .set({ rank: neighbour.rank })
      .where(eq(schema.categories.id, me.id));
  });

  revalidatePath('/admin/categories');
  revalidatePath('/admin');
  revalidatePath('/', 'layout');
}

export async function deleteCategory(_prev: LadderState, form: FormData): Promise<LadderState> {
  await requireCapability('content:manage', '/admin/categories');
  const organizationId = orgId();
  const id = String(form.get('id') ?? '');
  const confirmCode = String(form.get('confirmCode') ?? '').trim();

  const [category] = await db()
    .select({ id: schema.categories.id, code: schema.categories.code })
    .from(schema.categories)
    .where(and(eq(schema.categories.organizationId, organizationId), eq(schema.categories.id, id)))
    .limit(1);
  if (category === undefined) return { error: 'That category no longer exists.' };

  if (confirmCode !== category.code) {
    return { error: `Type "${category.code}" to confirm.` };
  }

  // Refused while in use: deleting would cascade to events, entrants and
  // every result under them, in a tournament that may be finished and
  // wanted for the record.
  const [used] = await db()
    .select({ n: count(schema.events.id) })
    .from(schema.events)
    .where(eq(schema.events.categoryId, id));

  if ((used?.n ?? 0) > 0) {
    return {
      error: `${category.code} is used by ${used?.n} ${used?.n === 1 ? 'draw' : 'draws'}. Remove those first.`,
    };
  }

  await db()
    .delete(schema.categories)
    .where(and(eq(schema.categories.organizationId, organizationId), eq(schema.categories.id, id)));

  revalidatePath('/admin/categories');
  revalidatePath('/admin');
  return { ok: `Deleted ${category.code}.` };
}
