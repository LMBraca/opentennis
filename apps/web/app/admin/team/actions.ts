'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cancelInvitation, createOrResendInvitation, type MemberRole } from '@opentennis/db';
import { currentUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { currentLocale } from '@/lib/i18n/server';
import { sendAdminInviteEmail } from '@/lib/admin-invite-email';

export interface InviteActionState {
  readonly error?: 'entryNeedEmail' | 'inviteEmailInUse' | 'inviteSendFailed' | 'denied';
  readonly email?: string;
  readonly role?: MemberRole;
}

async function signedInInviteActor() {
  const user = await currentUser();
  if (user === null) redirect('/admin/login?next=%2Fadmin%2Fteam');
  return user;
}

function acceptOrigin(requestHost: string | null): string {
  const productionHost = process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? process.env['VERCEL_URL'];
  const deploymentHost =
    process.env['VERCEL_ENV'] === 'production' ? productionHost : process.env['VERCEL_URL'];
  const host =
    deploymentHost ??
    (process.env['NODE_ENV'] !== 'production' ? (requestHost ?? 'localhost:3000') : undefined);
  if (host === undefined || !/^[A-Za-z0-9.:[\]-]+(?::\d+)?$/.test(host)) {
    throw new Error('Invalid deployment host');
  }
  return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
}

async function sendInvite(
  email: string,
  token: string,
  inviterName: string,
  inviterEmail: string,
): Promise<void> {
  const { headers } = await import('next/headers');
  const requestHeaders = await headers();
  const origin = acceptOrigin(requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'));
  const locale = await currentLocale();
  const acceptUrl = new URL('/admin/invite/accept', origin);
  acceptUrl.searchParams.set('token', token);
  await sendAdminInviteEmail({
    email,
    inviterEmail,
    inviterName,
    acceptUrl: acceptUrl.toString(),
    locale,
  });
}

export async function inviteAdmin(
  _previous: InviteActionState,
  form: FormData,
): Promise<InviteActionState> {
  const user = await signedInInviteActor();
  const email = String(form.get('email') ?? '');
  const result = await createOrResendInvitation(db(), {
    organizationId: orgId(),
    actor: { id: user.id },
    email,
  });
  if (result.status === 'denied') return { error: 'denied', role: user.role };
  if (result.status === 'invalid-email') return { error: 'entryNeedEmail' };
  if (result.status === 'email-in-use') return { error: 'inviteEmailInUse' };

  const normalizedEmail = email.trim().toLowerCase();
  try {
    await sendInvite(normalizedEmail, result.token, user.name ?? user.email, user.email);
  } catch {
    revalidatePath('/admin/team');
    return { error: 'inviteSendFailed' };
  }

  revalidatePath('/admin/team');
  return { email: normalizedEmail };
}

export async function cancelInvite(
  _previous: InviteActionState,
  form: FormData,
): Promise<InviteActionState> {
  const user = await signedInInviteActor();
  const invitationId = String(form.get('invitationId') ?? '');
  if (invitationId === '') return {};
  const result = await cancelInvitation(db(), {
    organizationId: orgId(),
    actor: { id: user.id },
    invitationId,
  });
  if (result === 'denied') return { error: 'denied', role: user.role };
  revalidatePath('/admin/team');
  return {};
}
