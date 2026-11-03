'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SESSION_COOKIE, SESSION_DAYS, signIn, signOut } from '@opentennis/db';
import { db } from '@/lib/db';

export interface LoginState {
  readonly error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/admin');

  if (email === '' || password === '') {
    return { error: 'Enter your email and password.' };
  }

  const agent = (await headers()).get('user-agent') ?? undefined;
  const session = await signIn(db(), email, password, agent);

  if (session === null) {
    // One message for both causes. Saying "no such account" would let anyone
    // enumerate who has an admin login.
    return { error: 'Those details did not match an account.' };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  redirect(next.startsWith('/') ? next : '/admin');
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  await signOut(db(), store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  revalidatePath('/admin', 'layout');
  redirect('/admin/login');
}
