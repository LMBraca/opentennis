import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InviteStatus } from '../app/admin/team/team-controls';
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
});
