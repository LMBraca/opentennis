/**
 * INF-3 — scorekeeper link tokens.
 *
 * A volunteer on court 2 should be able to put a score in from their phone
 * without the club creating them an account, teaching them a password and
 * then owning that password forever. They get a link; the link is the
 * credential; the organizer can revoke it when the weekend is over.
 *
 * SHA-256, not scrypt — deliberately the opposite choice to `hashPassword`
 * in auth.ts. scrypt is slow on purpose because a human password has little
 * entropy and must resist offline guessing. These tokens are 32 random bytes,
 * so there is nothing to guess, and a slow hash on every score save would
 * just be latency at the side of a court. Same reasoning as the session
 * tokens in auth.ts, which this mirrors.
 *
 * The plaintext is returned once, at creation, and never stored. A leaked
 * database row cannot be replayed as a link.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import type { Database } from './client';
import { scorekeeperTokens } from './schema/entries';

/** Long enough that guessing is hopeless, short enough to survive a WhatsApp. */
const TOKEN_BYTES = 24;

export interface ScorekeeperGrant {
  readonly id: string;
  readonly organizationId: string;
  readonly tournamentId: string;
  readonly label: string;
}

export function hashScorekeeperToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Is this string even shaped like one of our tokens?
 *
 * Cheap rejection before touching the database, so a crawler hitting
 * /score/favicon.ico does not cost a query.
 */
export function looksLikeToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{24,64}$/.test(value);
}

export interface CreateTokenInput {
  readonly organizationId: string;
  readonly tournamentId: string;
  readonly label: string;
  readonly createdByUserId?: string | undefined;
  readonly expiresAt?: Date | undefined;
}

export async function createScorekeeperToken(
  db: Database,
  input: CreateTokenInput,
): Promise<{ readonly id: string; readonly token: string }> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  const [row] = await db
    .insert(scorekeeperTokens)
    .values({
      organizationId: input.organizationId,
      tournamentId: input.tournamentId,
      label: input.label,
      tokenHash: hashScorekeeperToken(token),
      ...(input.createdByUserId !== undefined ? { createdByUserId: input.createdByUserId } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    })
    .returning({ id: scorekeeperTokens.id });

  if (row === undefined) throw new Error('Could not create a scorekeeper link');
  return { id: row.id, token };
}

/**
 * Resolve a link to what it is allowed to do, or null.
 *
 * Revoked and expired are both null — the caller must not be able to tell a
 * cancelled link from a mistyped one, because that difference is useful only
 * to someone probing.
 *
 * `lastUsedAt` is touched so an organizer can see which links are actually
 * in use before revoking one mid-tournament.
 */
export async function scorekeeperFromToken(
  db: Database,
  token: string | undefined,
): Promise<ScorekeeperGrant | null> {
  if (token === undefined || !looksLikeToken(token)) return null;

  const hash = hashScorekeeperToken(token);
  const [row] = await db
    .select({
      id: scorekeeperTokens.id,
      organizationId: scorekeeperTokens.organizationId,
      tournamentId: scorekeeperTokens.tournamentId,
      label: scorekeeperTokens.label,
      tokenHash: scorekeeperTokens.tokenHash,
    })
    .from(scorekeeperTokens)
    .where(
      and(
        eq(scorekeeperTokens.tokenHash, hash),
        isNull(scorekeeperTokens.revokedAt),
        or(isNull(scorekeeperTokens.expiresAt), gt(scorekeeperTokens.expiresAt, new Date())),
      ),
    )
    .limit(1);

  if (row === undefined) return null;

  // The lookup was already by hash equality, so this adds nothing against a
  // remote attacker — but it keeps the comparison constant-time by habit, so
  // the pattern stays right if this ever becomes a scan.
  const a = Buffer.from(row.tokenHash, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await db
    .update(scorekeeperTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(scorekeeperTokens.id, row.id));

  return {
    id: row.id,
    organizationId: row.organizationId,
    tournamentId: row.tournamentId,
    label: row.label,
  };
}

export async function revokeScorekeeperToken(
  db: Database,
  organizationId: string,
  id: string,
): Promise<void> {
  await db
    .update(scorekeeperTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(scorekeeperTokens.organizationId, organizationId), eq(scorekeeperTokens.id, id)),
    );
}
