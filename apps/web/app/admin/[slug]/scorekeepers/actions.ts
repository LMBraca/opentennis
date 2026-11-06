'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { createScorekeeperToken, revokeScorekeeperToken, schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export interface TokenState {
  readonly ok?: string;
  readonly error?: string;
  /**
   * The link, in full, returned ONCE.
   *
   * Only ever lives in this action's result — never stored, never fetched
   * again. If the organizer loses it they revoke and issue another, which is
   * cheap, whereas a link that can be re-read from a page is a credential
   * sitting in the admin panel forever.
   */
  readonly issuedUrl?: string;
}

export async function createScorekeeper(
  _prev: TokenState,
  form: FormData,
): Promise<TokenState> {
  const user = await requireUser('/admin');
  const organizationId = orgId();
  const slug = String(form.get('slug') ?? '');
  const label = String(form.get('label') ?? '').trim().slice(0, 80);
  const baseUrl = String(form.get('baseUrl') ?? '').trim();

  if (label === '') return { error: 'Give the link a name, so you know whose it is.' };

  const [tournament] = await db()
    .select({ id: schema.tournaments.id })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)))
    .limit(1);
  if (tournament === undefined) return { error: 'Tournament not found.' };

  const { token } = await createScorekeeperToken(db(), {
    organizationId,
    tournamentId: tournament.id,
    label,
    createdByUserId: user.id,
  });

  revalidatePath(`/admin/${slug}/scorekeepers`);
  return {
    ok: `Link created for ${label}. Copy it now — it is not shown again.`,
    issuedUrl: `${baseUrl}/score/${token}`,
  };
}

export async function revokeScorekeeper(form: FormData): Promise<void> {
  await requireUser('/admin');
  const slug = String(form.get('slug') ?? '');
  const id = String(form.get('id') ?? '');
  if (id === '') return;

  await revokeScorekeeperToken(db(), orgId(), id);
  revalidatePath(`/admin/${slug}/scorekeepers`);
}
