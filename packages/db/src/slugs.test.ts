import { describe, expect, it } from 'vitest';
import {
  MAX_SLUG_LENGTH,
  isReservedSlug,
  isValidSlug,
  nextAvailableSlug,
  slugify,
  slugifyCategoryCode,
  tournamentSlug,
} from './slugs';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Riverside Autumn Open')).toBe('riverside-autumn-open');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Peña Tennis Clüb')).toBe('pena-tennis-club');
  });

  it('removes apostrophes without leaving a hyphen', () => {
    expect(slugify("St Mary's Club")).toBe('st-marys-club');
    expect(slugify('Côte d’Azur')).toBe('cote-dazur');
  });

  it('collapses runs of punctuation', () => {
    expect(slugify('Spring  ---  Open!!!')).toBe('spring-open');
  });

  it('never starts or ends with a hyphen', () => {
    expect(slugify('  --Open--  ')).toBe('open');
  });

  it('caps length without leaving a trailing hyphen', () => {
    const slug = slugify('a'.repeat(40) + ' ' + 'b'.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('slugifyCategoryCode', () => {
  it('distinguishes C from C+, which is the one collision the ladder cannot tolerate', () => {
    expect(slugifyCategoryCode('C')).toBe('c');
    expect(slugifyCategoryCode('C+')).toBe('c-plus');
    expect(slugifyCategoryCode('C')).not.toBe(slugifyCategoryCode('C+'));
  });

  it('slugs the whole default ladder uniquely', () => {
    const slugs = ['Open', 'A', 'B', 'C+', 'C', 'D'].map(slugifyCategoryCode);
    expect(slugs).toEqual(['open', 'a', 'b', 'c-plus', 'c', 'd']);
    expect(new Set(slugs).size).toBe(6);
  });
});

describe('tournamentSlug', () => {
  it('shortens the year to two digits for speaking aloud', () => {
    expect(tournamentSlug('Autumn Open', 2026)).toBe('autumn-open-26');
  });

  it('does not duplicate a year the name already carries', () => {
    expect(tournamentSlug('Autumn Open 2026', 2026)).toBe('autumn-open-2026');
    expect(tournamentSlug('Autumn Open 26', 2026)).toBe('autumn-open-26');
  });

  it('omits the year when none is given', () => {
    expect(tournamentSlug('Club Championships')).toBe('club-championships');
  });
});

describe('nextAvailableSlug', () => {
  it('returns the bare slug when it is free', () => {
    expect(nextAvailableSlug('Autumn Open', () => false)).toBe('autumn-open');
  });

  it('prefers a readable discriminator over a number', () => {
    // "autumn-open-riverside" is far more use to a reader than "autumn-open-2".
    const taken = new Set(['autumn-open']);
    expect(nextAvailableSlug('Autumn Open', (s) => taken.has(s), 'Riverside')).toBe(
      'autumn-open-riverside',
    );
  });

  it('falls back to numbering when the discriminator is also taken', () => {
    const taken = new Set(['autumn-open', 'autumn-open-riverside']);
    expect(nextAvailableSlug('Autumn Open', (s) => taken.has(s), 'Riverside')).toBe(
      'autumn-open-2',
    );
  });

  it('keeps counting past the first number', () => {
    const taken = new Set(['open', 'open-2', 'open-3']);
    expect(nextAvailableSlug('Open', (s) => taken.has(s))).toBe('open-4');
  });

  it('gives up loudly rather than looping forever', () => {
    expect(() => nextAvailableSlug('Open', () => true)).toThrow(/Could not find an available slug/);
  });
});

describe('reserved slugs', () => {
  it('rejects segments that would shadow a real route', () => {
    // A tournament slugged "api" would look like a routing bug, not a naming one.
    for (const slug of ['api', 'admin', 'enter', 't', 'settings']) {
      expect(isReservedSlug(slug), slug).toBe(true);
      expect(isValidSlug(slug), slug).toBe(false);
    }
  });

  it('allows ordinary tournament names', () => {
    for (const slug of ['autumn-open-26', 'club-championships', 'spring-doubles']) {
      expect(isValidSlug(slug), slug).toBe(true);
    }
  });
});

describe('isValidSlug', () => {
  it('rejects empty, overlong, and badly formed slugs', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a'.repeat(MAX_SLUG_LENGTH + 1))).toBe(false);
    expect(isValidSlug('-leading')).toBe(false);
    expect(isValidSlug('trailing-')).toBe(false);
    expect(isValidSlug('double--hyphen')).toBe(false);
    expect(isValidSlug('Upper-Case')).toBe(false);
    expect(isValidSlug('has space')).toBe(false);
    expect(isValidSlug('has_underscore')).toBe(false);
  });

  it('accepts anything slugify produces from a realistic name', () => {
    for (const name of [
      'Riverside Autumn Open',
      "St Mary's Club Championships",
      'Peña Tennis Clüb Invitational',
      'Spring  ---  Open!!!',
    ]) {
      expect(isValidSlug(slugify(name)), name).toBe(true);
    }
  });
});
