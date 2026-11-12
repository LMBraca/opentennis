import { randomBytes } from 'node:crypto';
import { and, count, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { hashPassword, hashToken, SESSION_DAYS, type SessionUser } from './auth';
import type { Database } from './client';
import { normalizeInviteEmail } from './invitations';
import { isMemberRole } from './roles';
import { memberships, passwordResets, sessions, users } from './schema/core';

const HOUR = 60 * 60 * 1_000;
const DAY = 24 * HOUR;

export const RESET_TTL_MS = HOUR;
export const RESET_EMAIL_LIMIT = 3;
export const RESET_IP_LIMIT = 10;

export type CreatePasswordResetResult = {
  readonly token: string;
  readonly expiresAt: Date;
  readonly email: string;
} | null;

export async function createPasswordReset(
  db: Database,
  input: { readonly email: string; readonly ip?: string | undefined; readonly now?: Date },
): Promise<CreatePasswordResetResult> {
  const email = normalizeInviteEmail(input.email);
  if (email === null) return null;

  const [user] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (user === undefined || user.passwordHash === null) return null;

  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - HOUR);
  const requestedIpHash = input.ip === undefined ? null : hashToken(input.ip);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('password_reset'), hashtext(${user.id}))`,
    );
    if (requestedIpHash !== null) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('password_reset_ip'), hashtext(${requestedIpHash}))`,
      );
    }

    const [userCount] = await tx
      .select({ value: count() })
      .from(passwordResets)
      .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.createdAt, cutoff)));
    if ((userCount?.value ?? 0) >= RESET_EMAIL_LIMIT) return false;

    if (requestedIpHash !== null) {
      const [ipCount] = await tx
        .select({ value: count() })
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.requestedIpHash, requestedIpHash),
            gt(passwordResets.createdAt, cutoff),
          ),
        );
      if ((ipCount?.value ?? 0) >= RESET_IP_LIMIT) return false;
    }

    await tx
      .update(passwordResets)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(passwordResets.userId, user.id),
          isNull(passwordResets.usedAt),
          isNull(passwordResets.invalidatedAt),
        ),
      );
    await tx.insert(passwordResets).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      requestedIpHash,
      createdAt: now,
    });
    return true;
  });

  return result ? { token, expiresAt, email: user.email } : null;
}

export async function getPasswordReset(
  db: Database,
  token: string | undefined,
  now = new Date(),
): Promise<{ readonly email: string } | null> {
  if (token === undefined || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [reset] = await db
    .select({
      userId: passwordResets.userId,
      expiresAt: passwordResets.expiresAt,
      usedAt: passwordResets.usedAt,
      invalidatedAt: passwordResets.invalidatedAt,
    })
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, hashToken(token)))
    .limit(1);
  if (
    reset === undefined ||
    reset.usedAt !== null ||
    reset.invalidatedAt !== null ||
    reset.expiresAt <= now
  ) {
    return null;
  }
  const [user] = await db
    .select({ email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, reset.userId))
    .limit(1);
  if (user === undefined || user.passwordHash === null) return null;
  return { email: user.email };
}

export type ConsumePasswordResetResult =
  | {
      readonly status: 'ok';
      readonly token: string;
      readonly expiresAt: Date;
      readonly user: SessionUser;
    }
  | { readonly status: 'invalid' }
  | { readonly status: 'password-too-short' };

export async function consumePasswordReset(
  db: Database,
  input: {
    readonly token: string | undefined;
    readonly newPassword: string;
    readonly userAgent?: string | undefined;
    readonly now?: Date;
  },
): Promise<ConsumePasswordResetResult> {
  if (input.newPassword.length < 10) return { status: 'password-too-short' };
  if (input.token === undefined || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) {
    return { status: 'invalid' };
  }

  const passwordHash = await hashPassword(input.newPassword);
  const sessionToken = randomBytes(32).toString('base64url');
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
  const tokenHash = hashToken(input.token);

  return db.transaction(async (tx) => {
    const [reset] = await tx
      .select({
        id: passwordResets.id,
        userId: passwordResets.userId,
        expiresAt: passwordResets.expiresAt,
        usedAt: passwordResets.usedAt,
        invalidatedAt: passwordResets.invalidatedAt,
      })
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, tokenHash))
      .for('update')
      .limit(1);
    if (
      reset === undefined ||
      reset.usedAt !== null ||
      reset.invalidatedAt !== null ||
      reset.expiresAt <= now
    ) {
      return { status: 'invalid' };
    }

    const [user] = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, reset.userId))
      .limit(1);
    if (user === undefined || user.passwordHash === null) return { status: 'invalid' };

    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, user.id));
    await tx.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, reset.id));
    await tx
      .update(passwordResets)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(passwordResets.userId, user.id),
          ne(passwordResets.id, reset.id),
          isNull(passwordResets.usedAt),
          isNull(passwordResets.invalidatedAt),
        ),
      );
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.insert(sessions).values({
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      expiresAt,
      userAgent: input.userAgent ?? null,
    });

    const [membership] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);

    return {
      status: 'ok',
      token: sessionToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role:
          membership !== undefined && isMemberRole(membership.role) ? membership.role : 'viewer',
      },
    };
  });
}
