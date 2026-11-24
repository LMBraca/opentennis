/**
 * The loading state for the admin tool.
 *
 * Not the brand splash. `app/(site)/layout.tsx` already draws the line
 * this follows — admin, score and style-guide are tools, and a full
 * screen of club branding is not part of a tool. An organizer moving
 * between the scores queue and the entrants list wants to see that the
 * tap registered, not a title card.
 *
 * This is the design system's Motion 9 (`CourtLoader`), which had no
 * caller after the public loading screen changed.
 */

import { CourtLoader } from '@/components/court-loader';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export default async function AdminLoading() {
  const dict = dictionary(await currentLocale());
  return <CourtLoader label={dict.loading} />;
}
