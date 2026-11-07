import type { TimeWindow } from '@opentennis/engine';
import { dictionary, fill, type Locale } from './i18n/dictionaries';

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || hours * 60 + minutes > 24 * 60) return null;
  return hours * 60 + minutes;
}

export type ScheduleWindowsResult =
  | { readonly ok: true; readonly windows: TimeWindow[] }
  | { readonly ok: false; readonly error: string };

export function parseScheduleWindows(formData: FormData, locale: Locale): ScheduleWindowsResult {
  const dict = dictionary(locale);
  const bands: Array<{ days: number[]; from: string; to: string }> = [
    { days: WEEKDAYS, from: 'weekdayAmFrom', to: 'weekdayAmTo' },
    { days: WEEKDAYS, from: 'weekdayPmFrom', to: 'weekdayPmTo' },
    { days: WEEKEND, from: 'weekendFrom', to: 'weekendTo' },
  ];
  const windows: TimeWindow[] = [];

  for (const band of bands) {
    const from = String(formData.get(band.from) ?? '');
    const to = String(formData.get(band.to) ?? '');
    if (from === '' && to === '') continue;
    if (from === '' || to === '') return { ok: false, error: dict.scheduleBothTimes };

    const startMinutes = toMinutes(from);
    const endMinutes = toMinutes(to);
    if (startMinutes === null || endMinutes === null) {
      return {
        ok: false,
        error: fill(dict.scheduleInvalidRange, { range: `${from}–${to}` }),
      };
    }
    if (endMinutes <= startMinutes) {
      return {
        ok: false,
        error: fill(dict.scheduleEndAfterStart, { range: `${from}–${to}` }),
      };
    }
    for (const dayOfWeek of band.days) windows.push({ dayOfWeek, startMinutes, endMinutes });
  }

  if (windows.length === 0) return { ok: false, error: dict.scheduleAtLeastOne };
  return { ok: true, windows };
}
