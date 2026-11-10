import { fill, type Dictionary } from './i18n/dictionaries';

export type EntryStatus = 'pending' | 'accepted' | 'rejected';

export function entryStatusCopy(
  status: EntryStatus,
  discipline: 'singles' | 'doubles',
  partnerName: string | undefined,
  dict: Dictionary,
): { readonly heading: string; readonly message: string } {
  if (status === 'pending') {
    return { heading: dict.entryPendingPlayerHeading, message: dict.entryPendingMessage };
  }
  if (status === 'rejected') {
    return { heading: dict.entryRejectedPlayerHeading, message: dict.entryRejectedMessage };
  }
  return {
    heading: dict.youreIn,
    message:
      discipline === 'doubles' && partnerName !== undefined
        ? fill(dict.enteredDoubles, { partner: partnerName })
        : dict.enteredSingles,
  };
}
