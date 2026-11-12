/**
 * Credential auth for administrators.
 *
 * DEVIATION FROM THE PRD, stated plainly: §9 names Better Auth. This is a
 * hand-rolled scrypt + server-side-session implementation instead, because
 * the product needs exactly one thing from auth — an admin signs in with an
 * email and a password — and Better Auth brings its own schema, adapter and
 * configuration surface for that one case. Everything here is standard
 * library: scrypt from node:crypto, no dependency.
 *
 * Swap it for Better Auth when the product needs OAuth, passkeys, or
 * multi-tenant invitations. The seam is small on purpose: four functions.
 *
 * Deliberate choices:
 *   - scrypt, not SHA. A password hash must be SLOW. N=16384 is ~100ms,
 *     which is unnoticeable at login and ruinous for an offline attacker.
 *   - Parameters stored inside the hash, so they can be raised later without
 *     invalidating existing passwords.
 *   - timingSafeEqual everywhere, so a wrong password cannot be found a byte
 *     at a time by measuring the response.
 *   - Sessions in the database, not a stateless JWT: signing out and
 *     revoking access are then the same operation.
 */

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  type ScryptOptions,
} from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Database } from './client';
import { memberships, sessions, users } from './schema/core';
import { isMemberRole, type MemberRole } from './roles';

/**
 * promisify() picks the three-argument overload and loses the options
 * parameter, so the wrapper is written out rather than generated.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (err, derived) => {
      if (err !== null) reject(err);
      else resolve(derived);
    });
  });
}

/** ~100ms per hash. Raise N as hardware improves; old hashes keep working. */
const SCRYPT_N = 16_384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LENGTH = 64;

export const SESSION_COOKIE = 'ot_session';
export const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) {
    // Length beats composition rules: a 10-character passphrase resists an
    // offline attack far better than "P@ss1!" ever did.
    throw new Error('Password must be at least 10 characters');
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');

  const derived = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  // Constant time, so a wrong password cannot be discovered byte by byte.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function hashToken(token: string): string {
  // The raw cookie value is never stored, so a leaked database row cannot be
  // replayed as a session.
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  /**
   * INF-2. From the membership row, defaulting to the least power rather
   * than the most: a user with no membership can look and nothing else.
   * The opposite default is how "every signed-in user is an admin" happened.
   */
  readonly role: MemberRole;
}

/** Verify credentials and open a session. Returns null on any failure. */
export async function signIn(
  db: Database,
  email: string,
  password: string,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date; user: SessionUser } | null> {
  const found = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  const user = found[0];
  // Hash anyway when the user does not exist, so a missing account and a
  // wrong password take the same time and cannot be told apart.
  const stored = user?.passwordHash ?? (await hashPassword('not-a-real-password'));
  const ok = await verifyPassword(password, stored);
  if (user === undefined || user.passwordHash === null || !ok) return null;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: userAgent ?? null,
  });

  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership !== undefined && isMemberRole(membership.role) ? membership.role : 'viewer',
    },
  };
}

export async function sessionFromToken(
  db: Database,
  token: string | undefined,
): Promise<SessionUser | null> {
  if (token === undefined || token === '') return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    // LEFT join: a user without a membership must still resolve, as a
    // viewer. An inner join would sign them out instead, which looks like
    // a broken password.
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role !== null && isMemberRole(row.role) ? row.role : 'viewer',
  };
}

export async function signOut(db: Database, token: string | undefined): Promise<void> {
  if (token === undefined || token === '') return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Housekeeping. Expired rows are dead weight, not a security hole. */
export async function purgeExpiredSessions(db: Database): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
