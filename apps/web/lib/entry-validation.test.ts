import { describe, expect, it } from 'vitest';
import { dictionary } from './i18n/dictionaries';
import {
  EMAIL_SHAPE,
  ENTRY_FIELDS,
  errorCount,
  firstInvalidField,
  validateEntry,
  type EntryValues,
} from './entry-validation';

const valid: EntryValues = {
  eventId: 'evt-1',
  fullName: 'Fernanda Ruiz',
  partnerName: '',
  email: 'fernanda@example.mx',
  phone: '664 123 4567',
};

describe('validateEntry', () => {
  it('accepts a complete singles entry', () => {
    expect(validateEntry(valid, false)).toEqual({});
  });

  it('names every missing field at once', () => {
    // The whole point of a summary: an empty submit should not be a
    // five-round guessing game.
    const errors = validateEntry(
      { eventId: '', fullName: '', partnerName: '', email: '', phone: '' },
      false,
    );
    expect(errors).toEqual({
      eventId: 'entryNeedDraw',
      fullName: 'entryNeedName',
      email: 'entryNeedEmail',
      phone: 'entryNeedPhone',
    });
    expect(errorCount(errors)).toBe(4);
  });

  it('requires a partner only for doubles', () => {
    expect(validateEntry(valid, false).partnerName).toBeUndefined();
    expect(validateEntry(valid, true).partnerName).toBe('entryNeedPartner');
    expect(validateEntry({ ...valid, partnerName: 'Cruz' }, true)).toEqual({});
  });

  it('treats whitespace as empty', () => {
    const errors = validateEntry({ ...valid, fullName: '   ', phone: '  ' }, false);
    expect(errors.fullName).toBe('entryNeedName');
    expect(errors.phone).toBe('entryNeedPhone');
  });

  it('does not reject real names', () => {
    for (const name of ["O'Brien", 'Ruiz-Beltrán', 'Ng', 'José María']) {
      expect(validateEntry({ ...valid, fullName: name }, false)).toEqual({});
    }
  });

  it('accepts and rejects the same emails the server does', () => {
    for (const good of ['a@b.mx', 'first.last+tag@sub.example.com']) {
      expect(EMAIL_SHAPE.test(good)).toBe(true);
      expect(validateEntry({ ...valid, email: good }, false)).toEqual({});
    }
    for (const bad of ['', 'nope', 'a@b', 'a b@c.mx', '@b.mx', 'a@.mx']) {
      expect(validateEntry({ ...valid, email: bad }, false).email).toBe('entryNeedEmail');
    }
  });

  it('trims before checking the email, so a pasted address with a space works', () => {
    expect(validateEntry({ ...valid, email: '  fernanda@example.mx ' }, false)).toEqual({});
  });
});

describe('firstInvalidField', () => {
  it('follows DOM order, not object order', () => {
    // The field to focus is the first one the player would SEE, which is
    // the draw select at the top of the form.
    const errors = validateEntry(
      { eventId: '', fullName: '', partnerName: '', email: '', phone: '' },
      false,
    );
    expect(firstInvalidField(errors)).toBe('eventId');
    expect(firstInvalidField({ phone: 'entryNeedPhone', email: 'entryNeedEmail' })).toBe('email');
  });

  it('is null when nothing is wrong', () => {
    expect(firstInvalidField({})).toBeNull();
  });
});

describe('message keys', () => {
  it('every key this module can return exists in both dictionaries', () => {
    // A missing key renders "undefined" under a field, and the type system
    // cannot see it because the lookup is dynamic.
    const errors = validateEntry(
      { eventId: '', fullName: '', partnerName: '', email: '', phone: '' },
      true,
    );
    for (const locale of ['en', 'es'] as const) {
      const dict = dictionary(locale) as unknown as Record<string, unknown>;
      for (const field of ENTRY_FIELDS) {
        const key = errors[field];
        if (key === undefined) continue;
        expect(typeof dict[key], `${locale}.${key}`).toBe('string');
        expect(dict[key]).not.toBe('');
      }
      expect(typeof dict.formErrorSummary1).toBe('string');
      expect(String(dict.formErrorSummaryN)).toContain('{n}');
    }
  });
});
