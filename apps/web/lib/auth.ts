/**
 * Request-scoped auth helpers for the web app.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, sessionFromToken, type SessionUser } from '@opentennis/db';
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
