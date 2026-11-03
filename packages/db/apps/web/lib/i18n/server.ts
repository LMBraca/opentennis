/**
 * Locale resolution for server components.
 *
 * The locale lives in a cookie rather than the URL. A URL prefix would mean
 * every printed QR code encodes one language, and the spec promises those
 * codes keep working for the life of the tournament -- a code printed in
 * English should still open for a Spanish-speaking member.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, dictionary, isLocale, type Dictionary, type Locale } from './dictionaries';

export const LOCALE_COOKIE = 'ot_locale';

export async function currentLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function t(): Promise<Dictionary> {
  return dictionary(await currentLocale());
}
