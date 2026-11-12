import 'server-only';
import { dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { adminInviteEmailHtml } from './admin-invite-email-html';

export class PasswordResetEmailError extends Error {
  constructor(
    readonly status: number,
    readonly responseErrorName: string,
  ) {
    super('Password reset email could not be sent');
    this.name = 'PasswordResetEmailError';
  }
}

export async function sendPasswordResetEmail(input: {
  readonly email: string;
  readonly resetUrl: string;
  readonly locale: Locale;
}): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'];
  if (apiKey === undefined || from === undefined) {
    throw new Error('Password reset email is not configured');
  }

  const dict = dictionary(input.locale);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: dict.resetEmailSubject,
      html: adminInviteEmailHtml({
        preheader: dict.resetEmailPreheader,
        heading: dict.resetEmailHeading,
        body: dict.resetEmailBody,
        linkLead: dict.resetEmailLinkLead,
        buttonLabel: dict.resetEmailButton,
        acceptUrl: input.resetUrl,
        ignore: dict.resetEmailIgnore,
        footer: dict.resetEmailFooter,
      }),
      text: [
        dict.resetEmailBody,
        dict.resetEmailLinkLead,
        input.resetUrl,
        dict.resetEmailIgnore,
      ].join('\n\n'),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const responseErrorName =
      typeof body === 'object' && body !== null && 'name' in body && typeof body.name === 'string'
        ? /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(body.name)
          ? body.name
          : 'unknown'
        : 'unknown';
    throw new PasswordResetEmailError(response.status, responseErrorName);
  }
}
