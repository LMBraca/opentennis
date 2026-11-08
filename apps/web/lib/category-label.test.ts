import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABEL_MAX,
  categoryLabelLength,
  categoryLabelProblem,
  slugifyCategory,
} from './category-label';

describe('categoryLabelProblem', () => {
  it('accepts the existing ladder untouched', () => {
    // OT-21 is explicit that Open / A / B / C+ / C / D must not be
    // disturbed by this change.
    for (const code of ['Open', 'A', 'B', 'C+', 'C', 'D']) {
      expect(categoryLabelProblem(code), code).toBeNull();
    }
  });

  it('accepts the name that used to be truncated', () => {
    // The reported case: 16 characters, silently cut to "QA Test Cate".
    expect(categoryLabelProblem('QA Test Category')).toBeNull();
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(categoryLabelProblem('')).toBe('empty');
    expect(categoryLabelProblem('   ')).toBe('empty');
  });

  it('rejects rather than silently truncating past the limit', () => {
    expect(categoryLabelProblem('x'.repeat(CATEGORY_LABEL_MAX))).toBeNull();
    expect(categoryLabelProblem('x'.repeat(CATEGORY_LABEL_MAX + 1))).toBe('tooLong');
  });

  it('does not spend the budget on spaces the organizer cannot see', () => {
    expect(categoryLabelProblem(`  ${'x'.repeat(CATEGORY_LABEL_MAX)}  `)).toBeNull();
  });

  it('rejects a name with nothing that can become a slug', () => {
    // Would produce an empty slug, and the slug is in every URL.
    expect(categoryLabelProblem('!!!')).toBe('noAlphanumeric');
    expect(categoryLabelProblem('—')).toBe('noAlphanumeric');
  });
});

describe('slugifyCategory', () => {
  it('keeps the shapes the printed QR codes rely on', () => {
    expect(slugifyCategory('C+')).toBe('c-plus');
    expect(slugifyCategory('Open')).toBe('open');
    expect(slugifyCategory('QA Test Category')).toBe('qa-test-category');
  });

  it('collapses runs and trims the edges', () => {
    expect(slugifyCategory('  A   B  ')).toBe('a-b');
    expect(slugifyCategory('--A--')).toBe('a');
  });
});

describe('categoryLabelLength', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(categoryLabelLength('Senior')).toBe(6);
    // 'ñ' is one unit, but an astral character is two — a .length counter
    // would disagree with the input's own maxLength.
    expect(categoryLabelLength('Niños')).toBe(5);
    expect(categoryLabelLength('AB')).toBe(2);
  });

  it('ignores surrounding whitespace, like the validator does', () => {
    expect(categoryLabelLength('  AB  ')).toBe(2);
  });
});
