import { NextResponse } from 'next/server';
import { acceptInvitation, SESSION_COOKIE, SESSION_DAYS } from '@opentennis/db';
import { db } from '@/lib/db';
import { validateInviteCredentials } from '@/lib/invite-validation';

function redirectToAccept(request: Request, token: string | undefined, error: string): NextResponse {
  const acceptUrl = new URL('/admin/invite/accept', request.url);
  acceptUrl.searchParams.set('token', token ?? '');
  acceptUrl.searchParams.set('error', error);
  return NextResponse.redirect(acceptUrl, 303);
}

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? undefined;
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');
  const error = validateInviteCredentials(name, password, confirmPassword);

  if (error !== null) {
    return redirectToAccept(request, token, error);
  }

  const result = await acceptInvitation(db(), {
    token,
    name,
    password,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });
  if (result.status !== 'accepted') {
    return redirectToAccept(request, token, 'invalid');
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
