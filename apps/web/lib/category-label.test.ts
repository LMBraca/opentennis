import { describe, expect, it } from 'vitest';
import { CATEGORY_LABEL_MAX_LENGTH, parseCategoryLabel } from './category-label';

describe('parseCategoryLabel', () => {
  it('accepts a full 40-character label', () => {
    const label = 'a'.repeat(CATEGORY_LABEL_MAX_LENGTH);
    expect(parseCategoryLabel(label)).toEqual({ ok: true, value: label });
  });

  it('rejects rather than truncates a label over the limit', () => {
    const label = 'a'.repeat(CATEGORY_LABEL_MAX_LENGTH + 1);
    expect(parseCategoryLabel(label)).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('rejects an empty label after trimming', () => {
    expect(parseCategoryLabel('   ')).toEqual({ ok: false, reason: 'empty' });
  });
});
