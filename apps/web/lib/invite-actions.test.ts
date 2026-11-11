import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancelInvitation: vi.fn(),
  createOrResendInvitation: vi.fn(),
  currentUser: vi.fn(),
  db: vi.fn(),
  orgId: vi.fn(),
  sendAdminInviteEmail: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ host: 'localhost:3000' })),
}));
vi.mock('@opentennis/db', () => ({
  cancelInvitation: mocks.cancelInvitation,
  createOrResendInvitation: mocks.createOrResendInvitation,
}));
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/db', () => ({ db: mocks.db, orgId: mocks.orgId }));
vi.mock('@/lib/i18n/server', () => ({ currentLocale: vi.fn() }));
vi.mock('@/lib/admin-invite-email', () => ({
  AdminInviteEmailError: class AdminInviteEmailError extends Error {
    constructor(
      readonly status: number,
      readonly responseErrorName: string,
    ) {
      super('Admin invite email could not be sent');
    }
  },
  sendAdminInviteEmail: mocks.sendAdminInviteEmail,
}));

import { inviteAdmin } from '../app/admin/team/actions';
import { AdminInviteEmailError } from './admin-invite-email';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('team invite action validation', () => {
  it('returns the localized email validation key for an empty email', async () => {
    mocks.db.mockReturnValue({});
    mocks.orgId.mockReturnValue('org-id');
    mocks.currentUser.mockResolvedValue({
      id: 'owner-id',
      name: 'Club Owner',
      email: 'owner@example.com',
      role: 'owner',
    });
    mocks.createOrResendInvitation.mockResolvedValue({ status: 'invalid-email' });
    const form = new FormData();

    await expect(inviteAdmin({}, form)).resolves.toEqual({ error: 'entryNeedEmail' });
    expect(mocks.createOrResendInvitation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: '' }),
    );
  });

  it('logs only the Resend HTTP status and error name when email delivery fails', async () => {
    mocks.db.mockReturnValue({});
    mocks.orgId.mockReturnValue('org-id');
    mocks.currentUser.mockResolvedValue({
      id: 'owner-id',
      name: 'Club Owner',
      email: 'owner@example.com',
      role: 'owner',
    });
    mocks.createOrResendInvitation.mockResolvedValue({ status: 'created', token: 'raw-token' });
    mocks.sendAdminInviteEmail.mockRejectedValue(
      new AdminInviteEmailError(503, 'rate_limit_exceeded'),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const form = new FormData();
    form.set('email', 'invitee@example.com');

    await expect(inviteAdmin({}, form)).resolves.toEqual({ error: 'inviteSendFailed' });
    expect(log).toHaveBeenCalledWith('Admin invite email failed', {
      status: 503,
      name: 'rate_limit_exceeded',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('raw-token');
    expect(JSON.stringify(log.mock.calls)).not.toContain('invitee@example.com');
  });

  it('shows cancellation feedback only after the invite was cancelled', async () => {
    mocks.db.mockReturnValue({});
    mocks.orgId.mockReturnValue('org-id');
    mocks.currentUser.mockResolvedValue({
      id: 'owner-id',
      name: 'Club Owner',
      email: 'owner@example.com',
      role: 'owner',
    });
    mocks.cancelInvitation.mockResolvedValue('cancelled');
    const form = new FormData();
    form.set('invitationId', 'invite-id');

    const { cancelInvite } = await import('../app/admin/team/actions');
    await expect(cancelInvite({}, form)).resolves.toEqual({ cancelled: true });
  });
});
