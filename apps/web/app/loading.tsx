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
 *
 * It shows the brand mark full-screen rather than a widget on a blank
 * page: this is the whole-screen case, and the only thing worth showing
 * at that moment is whose site is arriving.
 *
 * `CourtLoader` (design system Motion 9) is no longer used by anything
 * after this change. It is kept, not deleted, because it is the documented
 * primitive for an INLINE wait inside a page — a Suspense boundary around
 * a slow panel — and this site has no such boundary yet.
 */

import { BrandLoader } from '@/components/brand-loader';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export default async function Loading() {
  const dict = dictionary(await currentLocale());
  return <BrandLoader label={dict.loading} />;
}
