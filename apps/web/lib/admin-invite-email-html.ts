/**
 * The HTML half of the admin invitation.
 *
 * Email is not the web, and almost none of this project's CSS survives the
 * trip. Custom properties do not resolve, so every colour here is the
 * literal hex from app/tokens.css rather than a `var()`. Stylesheets are
 * stripped, so everything is an inline `style`. Flexbox and grid are
 * unreliable in Outlook's Word rendering engine, so layout is tables —
 * which looks archaic and is simply what works.
 *
 * TYPE. The brand faces are Archivo (display) and Instrument Sans (text),
 * both Google fonts. Apple Mail and iOS Mail honour the <link> below and
 * render the real thing; Gmail strips it and falls back. So the fallback
 * stack matters as much as the font: both faces are grotesques, so it is
 * Helvetica Neue → Helvetica → Arial. There is no serif anywhere in this
 * product — an earlier version of this file set Georgia and read as a
 * different company's email.
 *
 * Pure and in `lib` for the usual reason: the only other way to see this
 * is to send a real email and look at it.
 *
 * The plain-text part is NOT replaced. A multipart message keeps both, and
 * the text version is what a screen reader in text mode, a terminal
 * client, and most spam filters actually read.
 */

/** From app/tokens.css. Inlined because email cannot read custom properties. */
const C = {
  band: '#3b4a21', // --clay-700
  accent: '#526430', // --clay-500
  ink: '#16180f', // --ink-900
  muted: '#64684f', // --ink-500
  line: '#d8dac9', // --line-200
  page: '#f4f5f2', // --paper-50
  surface: '#ffffff', // --paper-0
} as const;

/** Archivo for display, Instrument Sans for text — see the note above. */
const DISPLAY = "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";
const TEXT = "'Instrument Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

/**
 * Escape before interpolation. The inviter's name is user input and this
 * builds markup — the same rule lib/markdown.ts follows, for the same
 * reason.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Images in email need an absolute URL, and it has to be a host the
 * recipient can reach — not a relative path and not localhost. Taking the
 * origin from the accept link means a preview deployment sends its own
 * assets and production sends production's, with no extra env var to keep
 * in sync. The fallback only matters if the URL is unparseable, which would
 * mean the invitation is broken anyway.
 */
function originOf(acceptUrl: string): string {
  try {
    return new URL(acceptUrl).origin;
  } catch {
    return 'https://www.opentennis.mx';
  }
}

export interface InviteEmailContent {
  readonly preheader: string;
  readonly heading: string;
  readonly body: string;
  readonly linkLead: string;
  readonly buttonLabel: string;
  readonly acceptUrl: string;
  readonly ignore: string;
  readonly footer: string;
}

export function adminInviteEmailHtml(content: InviteEmailContent): string {
  const t = {
    preheader: escapeHtml(content.preheader),
    heading: escapeHtml(content.heading),
    body: escapeHtml(content.body),
    linkLead: escapeHtml(content.linkLead),
    buttonLabel: escapeHtml(content.buttonLabel),
    ignore: escapeHtml(content.ignore),
    footer: escapeHtml(content.footer),
    // Also escaped: it lands in an href AND in visible text.
    url: escapeHtml(content.acceptUrl),
  };
  const logo = escapeHtml(originOf(content.acceptUrl) + '/brand/open-tennis-white.png');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.heading}</title>
<!-- Apple Mail and iOS honour this and get the real brand faces. Gmail
     strips it, which is why every inline font-family below carries a
     grotesque fallback rather than relying on the webfont loading. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Instrument+Sans:wght@400;600&display=swap">
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<!-- The line shown in an inbox list beside the subject. Hidden in the body
     itself; without it clients preview whatever text comes first, which is
     usually the greeting repeated. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${t.preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr>
<td align="center" style="padding:32px 16px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.surface};border:1px solid ${C.line};border-radius:2px;">

<!-- The brand band, same green the site opens on, carrying the real mark.
     width/height are attributes as well as styles because Outlook sizes
     from the attribute. The alt text is styled to match the wordmark it
     replaces, so a client with images off still shows "Open Tennis" set in
     the brand face on the brand green rather than a broken-image box. -->
<tr>
<td style="background:${C.band};padding:24px 32px;">
<img src="${logo}" alt="Open Tennis" width="150" height="58"
     style="display:block;width:150px;height:58px;border:0;outline:none;text-decoration:none;font-family:${DISPLAY};font-size:20px;font-weight:700;color:${C.surface};">
</td>
</tr>

<tr>
<td style="padding:32px;">
<h1 style="margin:0 0 16px;font-family:${DISPLAY};font-size:24px;line-height:1.25;font-weight:700;color:${C.ink};">${t.heading}</h1>
<p style="margin:0 0 24px;font-family:${TEXT};font-size:16px;line-height:1.55;color:${C.ink};">${t.body}</p>

<!-- Bulletproof-ish button: a padded anchor, not a styled div. Outlook
     ignores padding on inline elements, hence the table wrapper. -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
<tr>
<td align="center" bgcolor="${C.accent}" style="border-radius:2px;">
<a href="${t.url}" style="display:inline-block;padding:14px 28px;font-family:${TEXT};font-size:16px;font-weight:600;color:${C.surface};text-decoration:none;">${t.buttonLabel}</a>
</td>
</tr>
</table>

<!-- The raw URL as well. A button is a link a client may rewrite, strip or
     fail to render, and someone forwarding this from a phone needs
     something they can copy. -->
<p style="margin:0 0 8px;font-family:${TEXT};font-size:14px;line-height:1.5;color:${C.muted};">${t.linkLead}</p>
<p style="margin:0 0 24px;font-family:${MONO};font-size:13px;line-height:1.5;word-break:break-all;">
<a href="${t.url}" style="color:${C.accent};">${t.url}</a>
</p>

<hr style="border:0;border-top:1px solid ${C.line};margin:0 0 20px;">
<p style="margin:0;font-family:${TEXT};font-size:14px;line-height:1.5;color:${C.muted};">${t.ignore}</p>
</td>
</tr>
</table>

<p style="margin:20px 0 0;font-family:${TEXT};font-size:12px;line-height:1.5;color:${C.muted};">${t.footer}</p>

</td>
</tr>
</table>
</body>
</html>`;
}
