'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { createScorekeeperToken, revokeScorekeeperToken, schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';

export interface TokenState {
  readonly error?: 'scorekeeperMissingLabel' | 'scorekeeperTournamentNotFound';
  readonly issuedLabel?: string;
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
  const user = await requireCapability('scorekeepers:manage', '/admin');
  const organizationId = orgId();
  const slug = String(form.get('slug') ?? '');
  const label = String(form.get('label') ?? '').trim().slice(0, 80);
  const baseUrl = String(form.get('baseUrl') ?? '').trim();

  if (label === '') return { error: 'scorekeeperMissingLabel' };

  const [tournament] = await db()
    .select({ id: schema.tournaments.id })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)))
    .limit(1);
  if (tournament === undefined) return { error: 'scorekeeperTournamentNotFound' };

  const { token } = await createScorekeeperToken(db(), {
    organizationId,
    tournamentId: tournament.id,
    label,
    createdByUserId: user.id,
  });

  revalidatePath(`/admin/${slug}/scorekeepers`);
  return {
    issuedLabel: label,
    issuedUrl: `${baseUrl}/score/${token}`,
  };
}

export async function revokeScorekeeper(form: FormData): Promise<void> {
  await requireCapability('scorekeepers:manage', '/admin');
  const slug = String(form.get('slug') ?? '');
  const id = String(form.get('id') ?? '');
  if (id === '') return;

  await revokeScorekeeperToken(db(), orgId(), id);
  revalidatePath(`/admin/${slug}/scorekeepers`);
}

/**
 * OT-10 — reissue a link whose URL nobody can read any more.
 *
 * The stored value is a HASH, so an existing row genuinely cannot show its
 * URL again, and it should not: a credential that can be re-read from the
 * admin panel forever is a worse problem than a lost link. QA asked for a
 * copy button on existing rows; the honest answer is a replacement.
 *
 * Revoke-then-create rather than rotating in place, so the old link stops
 * working at a known moment and the audit row for the dead one survives.
 * The label carries over — "Mesa de control" is the same desk either way.
 *
 * Returns the new URL exactly once, through the same field `create` uses.
 */
export async function replaceScorekeeper(
  _prev: TokenState,
  form: FormData,
): Promise<TokenState> {
  const user = await requireCapability('scorekeepers:manage', '/admin');
  const organizationId = orgId();
  const slug = String(form.get('slug') ?? '');
  const id = String(form.get('id') ?? '');
  const baseUrl = String(form.get('baseUrl') ?? '').trim();
  if (id === '') return { error: 'scorekeeperTournamentNotFound' };

  // The label and tournament come from the row being replaced, never from
  // the form: this action must not be a way to mint a token for another
  // tournament by editing a hidden field.
  const [existing] = await db()
    .select({
      label: schema.scorekeeperTokens.label,
      tournamentId: schema.scorekeeperTokens.tournamentId,
    })
    .from(schema.scorekeeperTokens)
    .where(
      and(
        eq(schema.scorekeeperTokens.id, id),
        eq(schema.scorekeeperTokens.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (existing === undefined) return { error: 'scorekeeperTournamentNotFound' };

  await revokeScorekeeperToken(db(), organizationId, id);
  const { token } = await createScorekeeperToken(db(), {
    organizationId,
    tournamentId: existing.tournamentId,
    label: existing.label,
    createdByUserId: user.id,
  });

  revalidatePath(`/admin/${slug}/scorekeepers`);
  return { issuedLabel: existing.label, issuedUrl: `${baseUrl}/score/${token}` };
}
