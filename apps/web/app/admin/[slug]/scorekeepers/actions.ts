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
  readonly issuedId?: string;
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

  const { id, token } = await createScorekeeperToken(db(), {
    organizationId,
    tournamentId: tournament.id,
    label,
    createdByUserId: user.id,
  });

  revalidatePath(`/admin/${slug}/scorekeepers`);
  return {
    issuedLabel: label,
    issuedId: id,
    issuedUrl: `${baseUrl}/score/${token}`,
  };
}

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

  const [existing] = await db()
    .select({
      id: schema.scorekeeperTokens.id,
      tournamentId: schema.scorekeeperTokens.tournamentId,
      label: schema.scorekeeperTokens.label,
      revokedAt: schema.scorekeeperTokens.revokedAt,
    })
    .from(schema.scorekeeperTokens)
    .innerJoin(
      schema.tournaments,
      eq(schema.tournaments.id, schema.scorekeeperTokens.tournamentId),
    )
    .where(
      and(
        eq(schema.scorekeeperTokens.organizationId, organizationId),
        eq(schema.scorekeeperTokens.id, id),
        eq(schema.tournaments.slug, slug),
      ),
    )
    .limit(1);
  if (existing === undefined || existing.revokedAt !== null) {
    return { error: 'scorekeeperTournamentNotFound' };
  }

  const issued = await db().transaction(async (tx) => {
    await revokeScorekeeperToken(tx, organizationId, existing.id);
    return createScorekeeperToken(tx, {
      organizationId,
      tournamentId: existing.tournamentId,
      label: existing.label,
      createdByUserId: user.id,
    });
  });

  revalidatePath(`/admin/${slug}/scorekeepers`);
  return {
    issuedLabel: existing.label,
    issuedId: issued.id,
    issuedUrl: `${baseUrl}/score/${issued.token}`,
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
