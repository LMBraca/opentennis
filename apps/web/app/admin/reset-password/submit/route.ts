import { NextResponse } from 'next/server';
import { consumePasswordReset, SESSION_COOKIE, SESSION_DAYS } from '@opentennis/db';
import { db } from '@/lib/db';

function redirectToReset(request: Request, token: string | undefined, error: string): NextResponse {
  const resetUrl = new URL('/admin/reset-password', request.url);
  if (token !== undefined) resetUrl.searchParams.set('token', token);
  resetUrl.searchParams.set('error', error);
  return NextResponse.redirect(resetUrl, 303);
}

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? undefined;
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');

  if (confirmPassword === '' || password !== confirmPassword) {
    return redirectToReset(request, token, 'passwordMismatch');
  }
  if (password.length < 10) return redirectToReset(request, token, 'passwordTooShort');

  const result = await consumePasswordReset(db(), {
    token,
    newPassword: password,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  if (result.status === 'invalid') return redirectToReset(request, token, 'invalid');
  if (result.status === 'password-too-short') {
    return redirectToReset(request, token, 'passwordTooShort');
  }

  const response = NextResponse.redirect(new URL('/admin', request.url), 303);
  response.cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
}
