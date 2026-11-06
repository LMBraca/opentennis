/**
 * Request-scoped auth helpers for the web app.
 *
 * INF-2: `requireUser` answers "is somebody signed in", which for most of
 * this product's life was the ONLY question asked — so a viewer account and
 * the club owner had identical power, including deleting a tournament and
 * every result in it. `requireCapability` is the question that should have
 * been asked, and `guardCapability` is the version for server actions,
 * which cannot redirect usefully and must return an error instead.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  can,
  SESSION_COOKIE,
  sessionFromToken,
  type Capability,
  type SessionUser,
} from '@opentennis/db';
import { db } from './db';

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return sessionFromToken(db(), store.get(SESSION_COOKIE)?.value);
}

/**
 * Guard for admin pages. Redirects rather than throwing, and carries the
 * attempted path so signing in lands where the user was going.
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (user === null) {
    const suffix = returnTo === undefined ? '' : `?next=${encodeURIComponent(returnTo)}`;
    redirect(`/admin/login${suffix}`);
  }
  return user;
}

/**
 * Guard for a page that needs a specific power.
 *
 * Sends someone who is not signed in to the login page, and someone who IS
 * signed in but lacks the capability to the admin home with an explanation
 * — NOT back to login, which would read as "your password is wrong" and
 * have them trying it again.
 */
export async function requireCapability(
  capability: Capability,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!can(user.role, capability)) {
    redirect(`/admin?denied=${encodeURIComponent(capability)}`);
  }
  return user;
}

export interface Denied {
  readonly error: string;
}

/**
 * Guard for a server action.
 *
 * Returns the user, or a `{ error }` the action can hand straight back to
 * its form. Actions must not redirect for authorization: the result is
 * swallowed by the action response and the form just appears to do nothing.
 *
 * The message names the role, because "not allowed" with no explanation
 * sends somebody to the organizer saying the site is broken.
 */
export async function guardCapability(
  capability: Capability,
): Promise<{ user: SessionUser } | Denied> {
  const user = await currentUser();
  if (user === null) return { error: 'You are not signed in.' };
  if (!can(user.role, capability)) {
    return { error: `Your account (${user.role}) cannot do that.` };
  }
  return { user };
}

export function isDenied(result: { user: SessionUser } | Denied): result is Denied {
  return 'error' in result;
}
