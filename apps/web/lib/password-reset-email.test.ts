import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordResetEmailError, sendPasswordResetEmail } from './password-reset-email';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('password reset email', () => {
  it('sends a localized plain-text email without reply-to', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'OpenTennis <noreply@example.com>');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('https://api.resend.com/emails');
      expect(init?.method).toBe('POST');
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPasswordResetEmail({
      email: 'admin@example.com',
      resetUrl: 'https://preview.example/admin/reset-password?token=secret',
      locale: 'es',
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const message = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(message).toMatchObject({
      from: 'OpenTennis <noreply@example.com>',
      to: ['admin@example.com'],
      subject: 'Elige una contraseña nueva para Open Tennis',
      html: expect.stringContaining('src="https://preview.example/brand/open-tennis-white.png"'),
      text: [
        'Alguien pidió cambiar la contraseña de tu cuenta de Open Tennis. El enlace caduca en 1 hora y solo se puede usar una vez.',
        'Abre este enlace para elegir una contraseña nueva:',
        'https://preview.example/admin/reset-password?token=secret',
        'Si no lo pediste tú, ignora este correo. Tu contraseña no cambia.',
      ].join('\n\n'),
    });
    expect(message).not.toHaveProperty('reply_to');
    expect(message.html).toContain("'Archivo'");
    expect(message.html).toContain("'Instrument Sans'");
    expect(message.html).toContain('Elegir contraseña nueva');
  });

  it('uses the request locale for English mail', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'OpenTennis <noreply@example.com>');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe('https://api.resend.com/emails');
      expect(init?.method).toBe('POST');
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPasswordResetEmail({
      email: 'admin@example.com',
      resetUrl: 'https://preview.example/admin/reset-password?token=secret',
      locale: 'en',
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const message = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(message).toMatchObject({
      subject: 'Choose a new password for Open Tennis',
      html: expect.stringContaining('Choose a new password'),
      text: [
        'Someone asked to reset the password for your Open Tennis account. The link expires in 1 hour and can only be used once.',
        'Open this link to choose a new password:',
        'https://preview.example/admin/reset-password?token=secret',
        'If you didn’t ask for this, ignore this email. Your password stays the same.',
      ].join('\n\n'),
    });
    expect(message.html).toContain('Open Tennis, Mexicali, Mexico');
  });

  it('returns only the Resend status and error name for delivery failures', async () => {
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
      sendPasswordResetEmail({
        email: 'admin@example.com',
        resetUrl: 'https://example.com/admin/reset-password?token=secret',
        locale: 'en',
      }),
    ).rejects.toMatchObject({
      name: 'PasswordResetEmailError',
      status: 503,
      responseErrorName: 'rate_limit_exceeded',
    } satisfies Partial<PasswordResetEmailError>);
  });

  it('does not expose a token-shaped provider error name', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'OpenTennis <noreply@example.com>');
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ name: 'A'.repeat(43) }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(
      sendPasswordResetEmail({
        email: 'admin@example.com',
        resetUrl: 'https://example.com/admin/reset-password?token=secret',
        locale: 'en',
      }),
    ).rejects.toMatchObject({
      responseErrorName: 'unknown',
    });
  });
});
