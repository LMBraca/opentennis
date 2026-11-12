'use server';

import { after } from 'next/server';
import { headers } from 'next/headers';
import { createPasswordReset, normalizeInviteEmail } from '@opentennis/db';
import { db } from '@/lib/db';
import { currentLocale } from '@/lib/i18n/server';
import { PasswordResetEmailError, sendPasswordResetEmail } from '@/lib/password-reset-email';

export interface PasswordResetRequestState {
  readonly error?: 'entryNeedEmail';
  readonly email?: string;
  readonly sent?: boolean;
}

function resetOrigin(requestHost: string | null): string {
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

export async function requestPasswordReset(
  _previous: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const email = String(formData.get('email') ?? '');
  const normalizedEmail = normalizeInviteEmail(email);
  if (normalizedEmail === null) return { error: 'entryNeedEmail', email };

  const requestHeaders = await headers();
  const origin = resetOrigin(requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'));
  const locale = await currentLocale();
  const forwardedIp = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim();
  after(async () => {
    try {
      const result = await createPasswordReset(db(), {
        email: normalizedEmail,
        ip: forwardedIp === '' ? undefined : forwardedIp,
      });
      if (result === null) return;
      const resetUrl = new URL('/admin/reset-password', origin);
      resetUrl.searchParams.set('token', result.token);
      await sendPasswordResetEmail({
        email: result.email,
        resetUrl: resetUrl.toString(),
        locale,
      });
    } catch (error) {
      if (error instanceof PasswordResetEmailError) {
        console.error('Password reset email failed', {
          status: error.status,
          name: error.responseErrorName,
        });
      } else {
        const errorName = error instanceof Error ? error.name : 'unknown';
        console.error('Password reset email failed', {
          name: /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(errorName) ? errorName : 'unknown',
        });
      }
    }
  });
  return { sent: true, email };
}
