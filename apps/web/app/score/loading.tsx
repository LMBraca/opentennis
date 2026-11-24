/**
 * The loading state for a scorekeeper's token page. A tool, like admin —
 * see the note there.
 */

import { CourtLoader } from '@/components/court-loader';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export default async function ScoreLoading() {
  const dict = dictionary(await currentLocale());
  return <CourtLoader label={dict.loading} />;
}
