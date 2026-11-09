export const CATEGORY_LABEL_MAX_LENGTH = 40;

export type CategoryLabelResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'empty' | 'tooLong' };

export function parseCategoryLabel(input: string): CategoryLabelResult {
  const value = input.trim();
  if (value === '') return { ok: false, reason: 'empty' };
  if (value.length > CATEGORY_LABEL_MAX_LENGTH) {
    return { ok: false, reason: 'tooLong' };
  }
  return { ok: true, value };
}
