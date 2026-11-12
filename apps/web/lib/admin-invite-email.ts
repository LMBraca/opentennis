import 'server-only';
import { dictionary, fill, type Locale } from '@/lib/i18n/dictionaries';
import { adminInviteEmailHtml } from './admin-invite-email-html';

export class AdminInviteEmailError extends Error {
  constructor(
    readonly status: number,
    readonly responseErrorName: string,
  ) {
    super('Admin invite email could not be sent');
    this.name = 'AdminInviteEmailError';
  }
}

export async function sendAdminInviteEmail(input: {
  readonly email: string;
  readonly inviterEmail: string;
  readonly inviterName: string;
  readonly acceptUrl: string;
  readonly locale: Locale;
}): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'];
  if (apiKey === undefined || from === undefined) {
    throw new Error('Admin invite email is not configured');
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
      reply_to: input.inviterEmail,
      subject: dict.inviteEmailSubject,
      /*
       * Both parts, not one. The HTML is what almost everyone sees; the
       * text is what a terminal client, a screen reader in text mode and
       * most spam filters read, and dropping it is how a well-designed
       * email starts landing in junk.
       */
      html: adminInviteEmailHtml({
        preheader: dict.inviteEmailPreheader,
        heading: dict.inviteEmailHeading,
        body: fill(dict.inviteEmailBody, { name: input.inviterName }),
        linkLead: dict.inviteEmailLinkLead,
        buttonLabel: dict.inviteEmailButton,
        acceptUrl: input.acceptUrl,
        ignore: dict.inviteEmailIgnore,
        footer: dict.inviteEmailFooter,
      }),
      text: [
        fill(dict.inviteEmailBody, { name: input.inviterName }),
        dict.inviteEmailLinkLead,
        input.acceptUrl,
        dict.inviteEmailIgnore,
      ].join('\n\n'),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const responseErrorName =
      typeof body === 'object' &&
      body !== null &&
      'name' in body &&
      typeof body.name === 'string'
        ? body.name.slice(0, 128)
        : 'unknown';
    throw new AdminInviteEmailError(response.status, responseErrorName);
  }
}
