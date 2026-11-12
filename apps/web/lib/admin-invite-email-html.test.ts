import { describe, expect, it } from 'vitest';
import { adminInviteEmailHtml } from './admin-invite-email-html';

const base = {
  preheader: 'Caduca en 24 horas',
  heading: 'Invitación',
  body: 'Ana te invita a administrar Open Tennis.',
  linkLead: 'O copia este enlace:',
  buttonLabel: 'Aceptar invitación',
  acceptUrl: 'https://www.opentennis.mx/admin/invite/accept?token=abc',
  ignore: 'Si no esperabas este correo, ignóralo.',
  footer: 'Open Tennis · Tijuana',
};

describe('adminInviteEmailHtml', () => {
  it('puts the accept URL in the button and in copyable text', () => {
    const html = adminInviteEmailHtml(base);
    // Three times: the button href, the fallback link's href, and its
    // visible text. A client that strips the button must still leave
    // something a person can select and paste.
    expect(html.split(base.acceptUrl).length - 1).toBe(3);
  });

  it('escapes the body rather than interpolating markup', () => {
    const html = adminInviteEmailHtml({ ...base, body: '<script>alert(1)</script> invites you' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a URL carrying a quote, which would otherwise break out of href', () => {
    const html = adminInviteEmailHtml({ ...base, acceptUrl: 'https://x/?t="><b>' });
    expect(html).not.toContain('"><b>');
    expect(html).toContain('&quot;');
  });

  it('uses literal hex, because email cannot resolve custom properties', () => {
    const html = adminInviteEmailHtml(base);
    expect(html).not.toContain('var(--');
    expect(html).toContain('#3b4a21');
  });

  it('carries a hidden preheader so the inbox preview is not the greeting', () => {
    expect(adminInviteEmailHtml(base)).toContain(base.preheader);
  });

  it('inlines every style — a <style> block would be stripped', () => {
    expect(adminInviteEmailHtml(base)).not.toContain('<style');
  });
});
