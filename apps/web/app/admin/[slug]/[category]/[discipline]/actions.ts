'use server';

/**
 * Entrant management for one draw.
 *
 * Seeds are typed into a column and saved together rather than dragged.
 * That is what tournamentsoftware and Challonge both do, and it is the right
 * call here for two reasons: an organizer setting "1" and "2" wants two
 * keystrokes, not two drags, and a form of number inputs works on a phone,
 * with a keyboard, and with a screen reader — none of which is true of a
 * drag surface without a lot of extra work.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export interface SeedState {
  readonly error?: string;
  readonly ok?: string;
}

export async function saveSeeds(_prev: SeedState, formData: FormData): Promise<SeedState> {
  await requireUser();
  const organizationId = orgId();
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');

  const rows = await db()
    .select({ id: schema.entrants.id })
    .from(schema.entrants)
    .where(
      and(eq(schema.entrants.organizationId, organizationId), eq(schema.entrants.eventId, eventId)),
    );
  if (rows.length === 0) return { error: 'No entrants to seed.' };

  const ids = new Set(rows.map((r) => r.id));
  const assigned = new Map<string, number | null>();
  const used = new Map<number, string>();

  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith('seed:')) continue;
    const id = key.slice(5);
    if (!ids.has(id)) continue;

    const text = String(raw).trim();
    if (text === '') {
      assigned.set(id, null);
      continue;
    }

    const value = Number(text);
    if (!Number.isInteger(value) || value < 1) {
      return { error: `"${text}" is not a seed number. Use 1, 2, 3… or leave it blank.` };
    }
    if (value > rows.length) {
      return { error: `Seed ${value} is higher than the ${rows.length} entrants in this draw.` };
    }
    if (used.has(value)) {
      // Two entrants on the same seed would make the draw non-deterministic,
      // and the engine rejects it anyway. Catch it here with a better message.
      return { error: `Seed ${value} is used twice. Each seed can only go to one entrant.` };
    }
    used.set(value, id);
    assigned.set(id, value);
  }

  // Clear every seed first. Otherwise saving "1,2" over "1,2,3" leaves the
  // old 3 behind, and the unique constraint rejects a swap mid-update.
  await db()
    .update(schema.entrants)
    .set({ seed: null, updatedAt: new Date() })
    .where(inArray(schema.entrants.id, [...ids]));

  for (const [id, seed] of assigned) {
    if (seed === null) continue;
    await db()
      .update(schema.entrants)
      .set({ seed, updatedAt: new Date() })
      .where(eq(schema.entrants.id, id));
  }

  revalidatePath(`/admin/${slug}`);

  const count = [...assigned.values()].filter((v) => v !== null).length;
  return {
    ok:
      count === 0
        ? 'Seeds cleared. The draw will be drawn at random.'
        : `${count} ${count === 1 ? 'seed' : 'seeds'} saved.`,
  };
}

export async function clearSeeds(formData: FormData): Promise<void> {
  await requireUser();
  const organizationId = orgId();
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');

  await db()
    .update(schema.entrants)
    .set({ seed: null, updatedAt: new Date() })
    .where(
      and(eq(schema.entrants.organizationId, organizationId), eq(schema.entrants.eventId, eventId)),
    );

  revalidatePath(`/admin/${slug}`);
}

/** Mark every entrant paid, or none. For the desk at the end of a session. */
export async function setAllPaid(formData: FormData): Promise<void> {
  await requireUser();
  const organizationId = orgId();
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const paid = String(formData.get('paid') ?? '') === 'true';

  await db()
    .update(schema.entrants)
    .set({ paid, paidAt: paid ? new Date() : null, updatedAt: new Date() })
    .where(
      and(eq(schema.entrants.organizationId, organizationId), eq(schema.entrants.eventId, eventId)),
    );

  revalidatePath(`/admin/${slug}`);
}
