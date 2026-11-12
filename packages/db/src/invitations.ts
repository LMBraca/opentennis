import { randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { hashPassword, hashToken, SESSION_DAYS } from './auth';
import type { Database } from './client';
import { can } from './roles';
import { invitations, memberships, sessions, users } from './schema/core';

const DAY = 86_400_000;

export function normalizeInviteEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function hashInvitationToken(token: string): string {
  return hashToken(token);
}

export interface InvitationActor {
  readonly id: string;
}

async function invitePermission(
  db: Pick<Database, 'select'>,
  organizationId: string,
  actorId: string,
): Promise<boolean> {
  const [member] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, actorId)))
    .limit(1);
  return member !== undefined && can(member.role, 'admins:invite');
}

export type CreateInvitationResult =
  | { readonly status: 'created' | 'resent'; readonly token: string; readonly expiresAt: Date }
  | { readonly status: 'denied' }
  | { readonly status: 'email-in-use' }
  | { readonly status: 'invalid-email' };

export async function createOrResendInvitation(
  db: Database,
  input: {
    readonly organizationId: string;
    readonly actor: InvitationActor;
    readonly email: string;
    readonly now?: Date;
  },
): Promise<CreateInvitationResult> {
  if (!(await invitePermission(db, input.organizationId, input.actor.id))) {
    return { status: 'denied' };
  }
  const email = normalizeInviteEmail(input.email);
  if (email === null) return { status: 'invalid-email' };
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + DAY);
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashInvitationToken(token);

  const result = await db.transaction(async (tx) => {
    if (!(await invitePermission(tx, input.organizationId, input.actor.id))) {
      return { status: 'denied' as const };
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.organizationId}), hashtext(${email}))`,
    );

    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (existingUser !== undefined) return { status: 'email-in-use' as const };

    const [pending] = await tx
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, input.organizationId),
          eq(invitations.email, email),
          isNull(invitations.consumedAt),
          isNull(invitations.cancelledAt),
        ),
      )
      .for('update')
      .limit(1);

    if (pending !== undefined) {
      await tx
        .update(invitations)
        .set({
          tokenHash,
          expiresAt,
          invitedByUserId: input.actor.id,
          updatedAt: now,
        })
        .where(eq(invitations.id, pending.id));
      return { status: 'resent' as const };
    }

    await tx.insert(invitations).values({
      organizationId: input.organizationId,
      email,
      tokenHash,
      expiresAt,
      invitedByUserId: input.actor.id,
    });
    return { status: 'created' as const };
  });

  if (result.status === 'email-in-use') return result;
  if (result.status === 'denied') return result;
  return { ...result, token, expiresAt };
}

export async function listPendingInvitations(
  db: Database,
  organizationId: string,
  actorId: string,
) {
  if (!(await invitePermission(db, organizationId, actorId))) return [];
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        isNull(invitations.consumedAt),
        isNull(invitations.cancelledAt),
      ),
    )
    .orderBy(invitations.createdAt);
}

export async function cancelInvitation(
  db: Database,
  input: {
    readonly organizationId: string;
    readonly actor: InvitationActor;
    readonly invitationId: string;
    readonly now?: Date;
  },
): Promise<'cancelled' | 'denied' | 'missing'> {
  if (!(await invitePermission(db, input.organizationId, input.actor.id))) return 'denied';
  const [row] = await db
    .update(invitations)
    .set({ cancelledAt: input.now ?? new Date(), updatedAt: input.now ?? new Date() })
    .where(
      and(
        eq(invitations.id, input.invitationId),
        eq(invitations.organizationId, input.organizationId),
        isNull(invitations.consumedAt),
        isNull(invitations.cancelledAt),
      ),
    )
    .returning({ id: invitations.id });
  return row === undefined ? 'missing' : 'cancelled';
}

export async function invitationEmailForToken(
  db: Database,
  token: string | undefined,
  now = new Date(),
): Promise<string | null> {
  if (token === undefined || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const [row] = await db
    .select({
      email: invitations.email,
      expiresAt: invitations.expiresAt,
      cancelledAt: invitations.cancelledAt,
      consumedAt: invitations.consumedAt,
    })
    .from(invitations)
    .where(eq(invitations.tokenHash, hashInvitationToken(token)))
    .limit(1);
  if (
    row === undefined ||
    row.cancelledAt !== null ||
    row.consumedAt !== null ||
    row.expiresAt <= now
  ) {
    return null;
  }
  return row.email;
}

export type AcceptInvitationResult =
  | { readonly status: 'accepted'; readonly sessionToken: string }
  | { readonly status: 'invalid' | 'email-in-use' | 'password-too-short' };

export async function acceptInvitation(
  db: Database,
  input: {
    readonly token: string | undefined;
    readonly name: string;
    readonly password: string;
    readonly userAgent?: string | undefined;
    readonly now?: Date;
  },
): Promise<AcceptInvitationResult> {
  const name = input.name.trim();
  if (name === '' || input.token === undefined || !/^[A-Za-z0-9_-]{40,50}$/.test(input.token)) {
    return { status: 'invalid' };
  }
  if (input.password.length < 10) return { status: 'password-too-short' };

  const sessionToken = randomBytes(32).toString('base64url');
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
  const tokenHash = hashInvitationToken(input.token);

  try {
    return await db.transaction(async (tx) => {
      const [invitation] = await tx
        .select({
          id: invitations.id,
          organizationId: invitations.organizationId,
          email: invitations.email,
          expiresAt: invitations.expiresAt,
          cancelledAt: invitations.cancelledAt,
          consumedAt: invitations.consumedAt,
        })
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .for('update')
        .limit(1);

      if (
        invitation === undefined ||
        invitation.cancelledAt !== null ||
        invitation.consumedAt !== null ||
        invitation.expiresAt <= now
      ) {
        return { status: 'invalid' as const };
      }

      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${invitation.email}`)
        .limit(1);
      if (existingUser !== undefined) return { status: 'email-in-use' as const };

      const passwordHash = await hashPassword(input.password);
      const [user] = await tx
        .insert(users)
        .values({
          email: invitation.email,
          name,
          emailVerified: true,
          passwordHash,
        })
        .returning({ id: users.id });
      if (user === undefined) throw new Error('Could not create invited user');

      await tx.insert(memberships).values({
        organizationId: invitation.organizationId,
        userId: user.id,
        role: 'admin',
      });
      await tx.insert(sessions).values({
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        expiresAt,
        userAgent: input.userAgent ?? null,
      });
      await tx
        .update(invitations)
        .set({ consumedAt: now, updatedAt: now })
        .where(eq(invitations.id, invitation.id));

      return { status: 'accepted' as const, sessionToken };
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === 'users_email_unique'
    ) {
      return { status: 'email-in-use' };
    }
    throw error;
  }
}
