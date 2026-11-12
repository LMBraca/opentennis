import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InviteStatus, TeamInviteManagement } from '../app/admin/team/team-controls';
import { dictionary } from './i18n/dictionaries';

describe('team invite status slot', () => {
  it('renders cancellation in the shared status slot instead of an earlier invite-sent message', () => {
    const markup = renderToStaticMarkup(
      createElement(InviteStatus, {
        dict: dictionary('es'),
        email: 'invitado@example.com',
        cancelled: true,
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('Invitación cancelada.');
    expect(markup).not.toContain('Enviamos la invitación a');
  });

  it('uses the same status slot for a successful invite', () => {
    const markup = renderToStaticMarkup(
      createElement(InviteStatus, {
        dict: dictionary('en'),
        email: 'invitee@example.com',
        cancelled: false,
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('We sent the invite to invitee@example.com.');
  });

  it('renders the invite, organizer, and pending sections in order', () => {
    const dict = dictionary('es');
    const markup = renderToStaticMarkup(
      createElement(
        TeamInviteManagement,
        {
          dict,
          invitations: [{ id: 'invite-1', email: 'pending@example.com', expires: '12 nov 2026' }],
        },
        createElement('section', null, createElement('h2', null, dict.currentOrganizers)),
      ),
    );

    expect(markup.indexOf(dict.inviteAdmin)).toBeLessThan(markup.indexOf(dict.currentOrganizers));
    expect(markup.indexOf(dict.currentOrganizers)).toBeLessThan(
      markup.indexOf(dict.pendingInvites),
    );
  });
});
