/**
 * The loading state for every public page.
 *
 * `app/loading.tsx` does not cover these, and the reason is easy to get
 * wrong: a `loading.tsx` only re-suspends for segments BELOW it that
 * change. The root one sits above `app/(site)/layout.tsx`, and that
 * layout is preserved on every navigation between public pages — so the
 * boundary never re-entered and opening a draw showed a blank white page
 * while the server read Postgres. It only ever fired on a cold load.
 *
 * The rule: a loading file is needed at, or below, every layout that
 * persists across the navigations it should cover.
 */

import { BrandLoader } from '@/components/brand-loader';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export default async function SiteLoading() {
  const dict = dictionary(await currentLocale());
  return <BrandLoader label={dict.loading} />;
}
