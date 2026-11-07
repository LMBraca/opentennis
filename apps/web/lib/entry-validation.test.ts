import { describe, expect, it } from 'vitest';
import { validateEntryFields } from './entry-validation';

describe('validateEntryFields', () => {
  it('returns localized field keys for missing or invalid values', () => {
    expect(
      validateEntryFields(
        { eventId: '', fullName: '', partnerName: '', email: 'bad', phone: '' },
        true,
      ),
    ).toEqual({
      eventId: 'needDraw',
      fullName: 'needName',
      partnerName: 'needPartner',
      email: 'needEmail',
      phone: 'needPhone',
    });
  });

  it('does not require a partner for singles and accepts valid values', () => {
    expect(
      validateEntryFields(
        { eventId: 'event', fullName: 'Ana Ruiz', partnerName: '', email: 'ana@example.mx', phone: '664' },
        false,
      ),
    ).toEqual({});
  });
});
