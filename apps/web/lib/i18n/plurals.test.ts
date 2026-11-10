import { describe, expect, it } from 'vitest';
import { pluralForm } from './dictionaries';

describe('pluralForm', () => {
  it.each(['en', 'en-GB', 'es', 'es-MX'])('%s uses locale plural categories', (locale) => {
    expect(pluralForm(locale, 0)).toBe('other');
    expect(pluralForm(locale, 1)).toBe('one');
    expect(pluralForm(locale, 2)).toBe('other');
  });
});
