/**
 * Who is allowed to record a score, and under what name.
 *
 * Two kinds of actor, and the score log already anticipated both: DB-6 says
 * `score_events.actorUserId` is "Null when the actor was a link-token
 * scorekeeper rather than a user". This is the function that produces one or
 * the other.
 *
 * A token is scoped to ONE tournament, so every write has to check the match
 * belongs to it. Without that check a link handed to a volunteer at the
 * November club night would also score the December open — the token would
 * be an account, which is the thing it exists to avoid.
 */

import 'server-only';
import { eq } from 'drizzle-orm';
import { schema, scorekeeperFromToken } from '@opentennis/db';
import { db, orgId } from './db';
import { currentUser } from './auth';

export interface ScoringActor {
  /** Null for a link-token scorekeeper, which is a real recorded state. */
  readonly userId: string | null;
  /** What shows in the audit log: an email, or the link's label. */
  readonly label: string;
  /** Null for an admin, who is not confined to one tournament. */
  readonly tournamentId: string | null;
  readonly kind: 'user' | 'scorekeeper';
}

/**
 * Resolve the actor from the session first, then a link token.
 *
 * Session first because an organizer who happens to have a scorekeeper link
 * open should still be logged as themselves.
 */
export async function resolveScoringActor(token: string | null): Promise<ScoringActor | null> {
  const user = await currentUser();
  if (user !== null) {
    return { userId: user.id, label: user.email, tournamentId: null, kind: 'user' };
  }

  const grant = await scorekeeperFromToken(db(), token ?? undefined);
  if (grant === null) return null;
  // A token from another organization is not a token here.
  if (grant.organizationId !== orgId()) return null;

  return {
    userId: null,
    label: grant.label,
    tournamentId: grant.tournamentId,
    kind: 'scorekeeper',
  };
}

/**
 * May this actor touch this match?
 *
 * Always true for a signed-in organizer. For a link, the match must belong
 * to the tournament the link was issued for.
 */
export async function actorMayScore(actor: ScoringActor, matchId: string): Promise<boolean> {
  if (actor.tournamentId === null) return true;

  const [row] = await db()
    .select({ tournamentId: schema.matches.tournamentId })
    .from(schema.matches)
    .where(eq(schema.matches.id, matchId))
    .limit(1);

  return row !== undefined && row.tournamentId === actor.tournamentId;
}
