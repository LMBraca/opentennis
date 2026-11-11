import { describe, expect, it, vi } from 'vitest';

const { acceptInvitation } = vi.hoisted(() => ({ acceptInvitation: vi.fn() }));

vi.mock('@opentennis/db', () => ({
  acceptInvitation,
  SESSION_COOKIE: 'ot_session',
  SESSION_DAYS: 30,
}));

vi.mock('@/lib/db', () => ({ db: vi.fn(() => ({})) }));

import { POST } from '../app/admin/invite/accept-submit/route';

describe('admin invite acceptance validation redirects', () => {
  it.each([
    {
      error: 'entryNeedName',
      name: ' ',
      password: 'long enough password',
      confirmPassword: 'long enough password',
    },
    {
      error: 'passwordTooShort',
      name: 'New Admin',
      password: 'short',
      confirmPassword: 'short',
    },
    {
      error: 'passwordMismatch',
      name: 'New Admin',
      password: 'long enough password',
      confirmPassword: '',
    },
  ])('redirects $error to the accept page without attempting account creation', async (input) => {
    const form = new FormData();
    form.set('name', input.name);
    form.set('password', input.password);
    form.set('confirmPassword', input.confirmPassword);

    const response = await POST(
      new Request('https://example.com/admin/invite/accept-submit?token=one-time-token', {
        method: 'POST',
        body: form,
      }),
    );

    const location = new URL(response.headers.get('location') ?? '');
    expect(response.status).toBe(303);
    expect(location.pathname).toBe('/admin/invite/accept');
    expect(location.searchParams.get('token')).toBe('one-time-token');
    expect(location.searchParams.get('error')).toBe(input.error);
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('keeps an explicit empty token parameter when the POST has no token', async () => {
    const form = new FormData();
    form.set('name', '');

    const response = await POST(
      new Request('https://example.com/admin/invite/accept-submit', {
        method: 'POST',
        body: form,
      }),
    );
    const location = new URL(response.headers.get('location') ?? '');

    expect(response.status).toBe(303);
    expect(location.pathname).toBe('/admin/invite/accept');
    expect(location.searchParams.has('token')).toBe(true);
    expect(location.searchParams.get('token')).toBe('');
    expect(location.searchParams.get('error')).toBe('entryNeedName');
    expect(acceptInvitation).not.toHaveBeenCalled();
  });
});
