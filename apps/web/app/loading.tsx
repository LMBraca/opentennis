/**
 * The root loading state.
 *
 * Next renders this while a server component suspends, which on this site
 * is any page waiting on a database read. There was none, so a slow
 * connection got a blank screen and no sign the tap had registered.
 *
 * Deliberately at the root rather than per route: every page here does the
 * same thing — read Postgres, render — so one is enough until a route
 * needs something different.
 */

import { CourtLoader } from '@/components/court-loader';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export default async function Loading() {
  const dict = dictionary(await currentLocale());
  return <CourtLoader label={dict.loading} />;
}
