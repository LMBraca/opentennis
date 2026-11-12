import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createPasswordReset: vi.fn(),
  currentLocale: vi.fn(),
  db: vi.fn(),
  headers: vi.fn(),
  normalizeInviteEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@opentennis/db', () => ({
  createPasswordReset: mocks.createPasswordReset,
  normalizeInviteEmail: mocks.normalizeInviteEmail,
}));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/i18n/server', () => ({ currentLocale: mocks.currentLocale }));
vi.mock('@/lib/password-reset-email', async () => {
  const actual =
    await vi.importActual<typeof import('./password-reset-email')>('./password-reset-email');
  return {
    ...actual,
    sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  };
});

import { requestPasswordReset } from '../app/admin/forgot-password/actions';
import { PasswordResetEmailError } from './password-reset-email';

const scheduled: Array<() => Promise<void>> = [];

beforeEach(() => {
  scheduled.length = 0;
  mocks.after.mockImplementation((callback: () => Promise<void>) => {
    scheduled.push(callback);
  });
  mocks.db.mockReturnValue({});
  mocks.headers.mockResolvedValue(
    new Headers({
      host: 'localhost:3000',
      'x-forwarded-for': '192.0.2.1, 10.0.0.1',
    }),
  );
  mocks.normalizeInviteEmail.mockImplementation((email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim().toLowerCase() : null,
  );
  mocks.currentLocale.mockResolvedValue('es');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('password reset request action', () => {
  it('rejects empty or invalid email with app validation and does not query the database', async () => {
    const form = new FormData();
    form.set('email', 'invalid');

    await expect(requestPasswordReset({}, form)).resolves.toEqual({
      error: 'entryNeedEmail',
      email: 'invalid',
    });
    expect(mocks.createPasswordReset).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it('shows the same neutral response for a known, unknown, and throttled email', async () => {
    const knownForm = new FormData();
    knownForm.set('email', ' Admin@Example.com ');
    mocks.createPasswordReset.mockResolvedValue({
      email: 'admin@example.com',
      token: 'raw-one-time-token',
      expiresAt: new Date('2026-11-10T13:00:00Z'),
    });
    const known = await requestPasswordReset({}, knownForm);
    expect(known).toEqual({ sent: true, email: ' Admin@Example.com ' });
    expect(mocks.createPasswordReset).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    await scheduled[0]!();
    expect(mocks.createPasswordReset).toHaveBeenCalledWith(expect.anything(), {
      email: 'admin@example.com',
      ip: '192.0.2.1',
    });

    mocks.createPasswordReset.mockResolvedValue(null);
    const unknownForm = new FormData();
    unknownForm.set('email', 'unknown@example.com');
    const unknown = await requestPasswordReset({}, unknownForm);
    expect(unknown).toEqual({ sent: true, email: 'unknown@example.com' });
    await scheduled[1]!();
    const throttledForm = new FormData();
    throttledForm.set('email', 'throttled@example.com');
    const throttled = await requestPasswordReset({}, throttledForm);
    expect(throttled).toEqual({ sent: true, email: 'throttled@example.com' });
    await scheduled[2]!();
    expect(scheduled).toHaveLength(3);

    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith({
      email: 'admin@example.com',
      resetUrl: 'http://localhost:3000/admin/reset-password?token=raw-one-time-token',
      locale: 'es',
    });
  });

  it('logs only the Resend status and error name if delivery fails', async () => {
    mocks.createPasswordReset.mockResolvedValue({
      email: 'admin@example.com',
      token: 'raw-one-time-token',
      expiresAt: new Date('2026-11-10T13:00:00Z'),
    });
    mocks.sendPasswordResetEmail.mockRejectedValue(
      new PasswordResetEmailError(503, 'rate_limit_exceeded'),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const form = new FormData();
    form.set('email', 'admin@example.com');

    await requestPasswordReset({}, form);
    await scheduled[0]!();

    expect(log).toHaveBeenCalledWith('Password reset email failed', {
      status: 503,
      name: 'rate_limit_exceeded',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('raw-one-time-token');
    expect(JSON.stringify(log.mock.calls)).not.toContain('admin@example.com');
  });

  it('uses the production deployment host instead of an untrusted request host', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'opentennis.example');
    mocks.createPasswordReset.mockResolvedValue({
      email: 'admin@example.com',
      token: 'raw-one-time-token',
      expiresAt: new Date('2026-11-10T13:00:00Z'),
    });
    const form = new FormData();
    form.set('email', 'admin@example.com');

    await requestPasswordReset({}, form);
    await scheduled[0]!();

    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        resetUrl: 'https://opentennis.example/admin/reset-password?token=raw-one-time-token',
      }),
    );
  });
});
