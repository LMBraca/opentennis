export type InviteCredentialError = 'entryNeedName' | 'passwordMismatch' | 'passwordTooShort';

export function validateInviteCredentials(
  name: string,
  password: string,
  confirmation: string,
): InviteCredentialError | null {
  if (name.trim() === '') return 'entryNeedName';
  if (confirmation === '' || password !== confirmation) return 'passwordMismatch';
  if (password.length < 10) return 'passwordTooShort';
  return null;
}
