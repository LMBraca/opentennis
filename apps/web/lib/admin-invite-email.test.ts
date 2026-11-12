import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminInviteEmailError, sendAdminInviteEmail } from './admin-invite-email';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('admin invite email', () => {
  it('sends the localized text and HTML parts, replying to the inviter', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'OpenTennis <noreply@example.com>');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('https://api.resend.com/emails');
      expect(init?.method).toBe('POST');
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendAdminInviteEmail({
      email: 'invitee@example.com',
      inviterEmail: 'organizer@example.com',
      inviterName: 'Ana',
      acceptUrl: 'https://preview.example/admin/invite/accept?token=secret',
      locale: 'es',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: 'OpenTennis <noreply@example.com>',
      to: ['invitee@example.com'],
      reply_to: 'organizer@example.com',
      subject: 'Invitación para administrar Open Tennis',
      text: [
        'Ana te invita a administrar Open Tennis. El enlace caduca en 24 horas y solo se puede usar una vez.',
        'Abre este enlace para elegir tu nombre y contraseña:',
        'https://preview.example/admin/invite/accept?token=secret',
        'Si no esperabas este correo, puedes ignorarlo.',
      ].join('\n\n'),
    });
    /*
     * The HTML part is now sent too. The text part above is asserted
     * verbatim and stays verbatim: it is the multipart fallback, and the
     * thing a terminal client or a spam filter actually reads.
     */
    expect(typeof body['html']).toBe('string');
    expect(String(body['html'])).toContain(
      'https://preview.example/admin/invite/accept?token=secret',
    );
  });

  it('uses the inviter locale for English invitations too', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'OpenTennis <noreply@example.com>');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('https://api.resend.com/emails');
      expect(init?.method).toBe('POST');
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendAdminInviteEmail({
      email: 'invitee@example.com',
      inviterEmail: 'organizer@example.com',
      inviterName: 'Alex',
      acceptUrl: 'https://preview.example/admin/invite/accept?token=one-time-token',
      locale: 'en',
    });

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      subject: 'An invite to administer Open Tennis',
      text: [
        'Alex is inviting you to help administer Open Tennis. The link expires in 24 hours and can only be used once.',
        'Open this link to choose your name and password:',
        'https://preview.example/admin/invite/accept?token=one-time-token',
        'If you weren’t expecting this email, you can ignore it.',
      ].join('\n\n'),
    });
  });

  it('throws on delivery failure so the pending invitation can be retried', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'OpenTennis <noreply@example.com>');
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ name: 'rate_limit_exceeded', message: 'do not log this' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(
      sendAdminInviteEmail({
        email: 'invitee@example.com',
        inviterEmail: 'organizer@example.com',
        inviterName: 'Ana',
        acceptUrl: 'https://example.com/admin/invite/accept?token=secret',
        locale: 'en',
      }),
    ).rejects.toMatchObject({
      name: 'AdminInviteEmailError',
      status: 503,
      responseErrorName: 'rate_limit_exceeded',
    } satisfies Partial<AdminInviteEmailError>);
  });
});
