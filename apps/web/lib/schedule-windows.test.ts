import { describe, expect, it } from 'vitest';
import { parseScheduleWindows } from './schedule-windows';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('parseScheduleWindows', () => {
  it('leaves unused dayparts empty and only creates windows for configured hours', () => {
    const result = parseScheduleWindows(
      form({ weekdayPmFrom: '18:00', weekdayPmTo: '22:00' }),
      'es',
    );

    expect(result).toEqual({
      ok: true,
      windows: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        dayOfWeek,
        startMinutes: 1080,
        endMinutes: 1320,
      })),
    });
  });

  it('rejects equal start and end with localized feedback in both locales', () => {
    const values = form({ weekdayAmFrom: '08:00', weekdayAmTo: '08:00' });
    const spanish = parseScheduleWindows(values, 'es');
    const english = parseScheduleWindows(values, 'en');

    expect(spanish).toMatchObject({ ok: false, error: expect.stringContaining('terminar') });
    expect(english).toMatchObject({
      ok: false,
      error: expect.stringContaining('end after it starts'),
    });
  });

  it('rejects a half-filled daypart and all-empty schedules', () => {
    expect(parseScheduleWindows(form({ weekdayAmFrom: '08:00' }), 'es')).toMatchObject({
      ok: false,
      error: expect.stringContaining('ambas en blanco'),
    });
    expect(parseScheduleWindows(form({}), 'en')).toMatchObject({
      ok: false,
      error: expect.stringContaining('at least one'),
    });
  });
});
