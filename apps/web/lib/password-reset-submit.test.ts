import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumePasswordReset: vi.fn(),
  db: vi.fn(),
}));

vi.mock('@opentennis/db', () => ({
  consumePasswordReset: mocks.consumePasswordReset,
  SESSION_COOKIE: 'ot_session',
  SESSION_DAYS: 30,
}));
vi.mock('@/lib/db', () => ({ db: mocks.db }));

import { POST } from '../app/admin/(auth)/reset-password/submit/route';

beforeEach(() => {
  mocks.db.mockReturnValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

function request(token: string | undefined, password: string, confirmation: string) {
  const form = new FormData();
  form.set('password', password);
  form.set('confirmPassword', confirmation);
  const url = new URL('https://example.com/admin/reset-password/submit');
  if (token !== undefined) url.searchParams.set('token', token);
  return new Request(url, { method: 'POST', body: form });
}

describe('password reset submission', () => {
  it.each([
    ['passwordMismatch', 'a sufficiently long password', 'different password'],
    ['passwordTooShort', 'short', 'short'],
  ])(
    'preserves the token and shows %s without saving a password',
    async (error, password, confirmation) => {
      const response = await POST(request('one-time-token', password, confirmation));
      const location = new URL(response.headers.get('location') ?? '');

      expect(response.status).toBe(303);
      expect(location.pathname).toBe('/admin/reset-password');
      expect(location.searchParams.get('token')).toBe('one-time-token');
      expect(location.searchParams.get('error')).toBe(error);
      expect(location.toString()).not.toContain(password);
      expect(mocks.consumePasswordReset).not.toHaveBeenCalled();
    },
  );

  it('redirects an invalid or superseded token to the invalid-link state', async () => {
    mocks.consumePasswordReset.mockResolvedValue({ status: 'invalid' });
    const response = await POST(
      request('one-time-token', 'a sufficiently long password', 'a sufficiently long password'),
    );
    const location = new URL(response.headers.get('location') ?? '');

    expect(location.pathname).toBe('/admin/reset-password');
    expect(location.searchParams.get('token')).toBe('one-time-token');
    expect(location.searchParams.get('error')).toBe('invalid');
  });

  it('sets the new session cookie and redirects to admin after a successful reset', async () => {
    mocks.consumePasswordReset.mockResolvedValue({
      status: 'ok',
      token: 'new-session-token',
      expiresAt: new Date('2026-12-10T12:00:00Z'),
      user: { id: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'owner' },
    });
    const response = await POST(
      request('one-time-token', 'a sufficiently long password', 'a sufficiently long password'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.com/admin');
    expect(response.cookies.get('ot_session')?.value).toBe('new-session-token');
    expect(mocks.consumePasswordReset).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        token: 'one-time-token',
        newPassword: 'a sufficiently long password',
      }),
    );
  });
});
