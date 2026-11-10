import { NextResponse } from 'next/server';
import { acceptInvitation, SESSION_COOKIE, SESSION_DAYS } from '@opentennis/db';
import { db } from '@/lib/db';
import { validateInviteCredentials } from '@/lib/invite-validation';

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? undefined;
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');
  const error = validateInviteCredentials(name, password, confirmPassword);

  if (error !== null) {
    url.searchParams.set('error', error);
    return NextResponse.redirect(url, 303);
  }

  const result = await acceptInvitation(db(), {
    token,
    name,
    password,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  if (result.status !== 'accepted') {
    const invalidUrl = new URL('/admin/invite/accept', request.url);
    invalidUrl.searchParams.set('error', 'invalid');
    return NextResponse.redirect(invalidUrl, 303);
  }

  const response = NextResponse.redirect(new URL('/admin', request.url), 303);
  response.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
}
