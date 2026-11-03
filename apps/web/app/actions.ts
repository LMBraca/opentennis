'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocale } from '@/lib/i18n/dictionaries';
import { LOCALE_COOKIE } from '@/lib/i18n/server';

/**
 * Persist the chosen language for a year.
 *
 * A server action rather than client state: every page is a server component,
 * so the switch has to happen before render or the first paint would be in
 * the wrong language.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const next = formData.get('locale');
  if (typeof next !== 'string' || !isLocale(next)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
