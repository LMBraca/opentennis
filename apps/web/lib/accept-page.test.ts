import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invitationEmailForToken: vi.fn(async () => 'invitee@example.com'),
}));

vi.mock('@opentennis/db', () => ({
  invitationEmailForToken: mocks.invitationEmailForToken,
}));
vi.mock('@/lib/db', () => ({ db: vi.fn(() => ({})) }));
vi.mock('@/lib/i18n/server', () => ({ currentLocale: vi.fn(async () => 'es') }));
vi.mock('../app/admin/invite/invite-page-shell', () => ({
  InvitePageShell: () => null,
}));
vi.mock('../app/admin/invite/accept/accept-form', () => ({
  AcceptInviteForm: () => null,
}));
vi.mock('../app/admin/invite/invalid-page', () => ({
  InvalidInvitePage: () => null,
}));

import { default as AcceptInvitePage, generateMetadata } from '../app/admin/invite/accept/page';
import { dictionary } from './i18n/dictionaries';

describe('admin invite acceptance page', () => {
  it('keeps the acceptance title for a valid token with an invalid-result error', async () => {
    Object.assign(globalThis, { React });
    const page = await AcceptInvitePage({
      searchParams: Promise.resolve({ token: 'still-valid', error: 'invalid' }),
    });

    expect(React.isValidElement(page)).toBe(true);
    expect((page as React.ReactElement<{ title: string }>).props.title).toBe(
      dictionary('es').acceptInviteTitle,
    );
  });

  it('uses the acceptance document title for a still-valid token with an invalid-result error', async () => {
    mocks.invitationEmailForToken.mockResolvedValue('invitee@example.com');
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ token: 'still-valid', error: 'invalid' }),
    });

    expect(metadata.title).toEqual({ absolute: 'Únete al equipo · OpenTennis' });
  });
});
