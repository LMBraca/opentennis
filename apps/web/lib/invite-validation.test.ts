import { describe, expect, it } from 'vitest';
import { validateInviteCredentials } from './invite-validation';

describe('admin invite credentials', () => {
  it('requires a display name', () => {
    expect(validateInviteCredentials('  ', 'long enough password', 'long enough password')).toBe(
      'entryNeedName',
    );
  });

  it('requires a matching non-empty confirmation', () => {
    expect(validateInviteCredentials('New Admin', 'long enough password', '')).toBe(
      'passwordMismatch',
    );
    expect(validateInviteCredentials('New Admin', 'long enough password', 'another password')).toBe(
      'passwordMismatch',
    );
  });

  it('enforces the existing ten-character password minimum', () => {
    expect(validateInviteCredentials('New Admin', 'short', 'short')).toBe('passwordTooShort');
    expect(
      validateInviteCredentials('New Admin', 'long enough password', 'long enough password'),
    ).toBeNull();
  });
});
