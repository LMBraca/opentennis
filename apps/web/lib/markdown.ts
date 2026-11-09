/**
 * A deliberately small Markdown subset for club updates.
 *
 * WHY NOT A LIBRARY: marked, remark and friends all parse raw HTML by
 * default, so using one safely means pairing it with a sanitiser and keeping
 * both configured correctly forever. The alternative is to never produce
 * markup we did not construct ourselves, which is what this does: every
 * character of input is escaped FIRST, and tags are only ever emitted by this
 * file. There is no configuration to get wrong and no path from the editor to
 * a <script>.
 *
 * The subset is what a tennis club actually writes: headings, paragraphs,
 * bold, italics, links, and lists. Tables, images and raw HTML are out --
 * images belong in the media gallery, which has alt-text fields.
 *
 * The cost is honest: this is not CommonMark and will not behave like it at
 * the edges. If the club ever needs real Markdown, swap in remark +
 * rehype-sanitize behind `renderMarkdown` and keep the tests.
 */

/** Escape first, always. Everything downstream appends to escaped text. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Only http(s) and mailto survive.
 *
 * `javascript:`, `data:` and friends are the whole reason this check exists;
 * a link is the one place a Markdown subset still hands an author control of
 * a URL. Anything else renders as plain text rather than as a dead link, so
 * the author sees that it did not work.
 */
function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
  // Protocol-relative and site-relative links are fine and common.
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return null;
}

function tournamentPathFromHref(href: string): string | null {
  const rawPath = href.split(/[?#]/, 1)[0] ?? '';
  const segments = rawPath.split('/');
  if (segments.at(-1) === '') segments.pop();
  if (segments[0] !== '' || segments[1] !== 't' || segments[2] === undefined || segments[2] === '') {
    return null;
  }
  try {
    const decoded = segments.slice(2).map((segment) => decodeURIComponent(segment));
    if (decoded.some((segment) => segment === '' || segment.includes('/'))) return null;
    return `/t/${decoded.join('/')}`.replace(/\/+$/, '') || '/t';
  } catch {
    return null;
  }
}

export function internalTournamentSlugs(source: string): string[] {
  const slugs = new Set<string>();
  for (const match of source.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const path = tournamentPathFromHref(match[2] as string);
    const slug = path?.split('/')[2];
    if (slug !== undefined) slugs.add(slug);
  }
  return [...slugs];
}

export function invalidTournamentLinks(source: string, validTournamentPaths: ReadonlySet<string>): string[] {
  const invalid = new Set<string>();
  for (const match of source.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const href = match[2] as string;
    if (!href.startsWith('/t/')) continue;
    const path = tournamentPathFromHref(href);
    if (path === null || !validTournamentPaths.has(path)) invalid.add(href);
  }
  return [...invalid];
}

/** Inline spans, applied to text that is ALREADY escaped. */
function inline(escaped: string, validTournamentPaths?: ReadonlySet<string>): string {
  return (
    escaped
      // [label](href) — the label is already escaped; the href is validated
      // and escaped again before it reaches an attribute.
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
        // The href arrives HTML-escaped, so &amp; must come back before the
        // scheme is checked -- otherwise a legitimate query string fails.
        const decoded = href.replace(/&amp;/g, '&').replace(/&#39;/g, "'");
        const safe = safeHref(decoded);
        if (safe === null) return match;
        if (safe.startsWith('/t/')) {
          const tournamentPath = tournamentPathFromHref(safe);
          if (tournamentPath === null || (validTournamentPaths !== undefined && !validTournamentPaths.has(tournamentPath))) {
            return label;
          }
        }
        const attr = escapeHtml(safe);
        const external = /^https?:\/\//i.test(safe);
        const rel = external ? ' target="_blank" rel="noreferrer noopener"' : '';
        return `<a href="${attr}"${rel}>${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  );
}

/**
 * Render to an HTML string.
 *
 * Blocks are separated by blank lines. Within a block, a single newline is a
 * line break, because club announcements are written that way and turning
 * "Saturday 9am\nSunday 10am" into one run-on line is never what was meant.
 */
export function renderMarkdown(
  source: string,
  validTournamentPaths?: ReadonlySet<string>,
): string {
  const blocks = source
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/);
  const out: string[] = [];

  for (const rawBlock of blocks) {
    /*
     * RV-15 — alignment, as a block directive.
     *
     * Markdown has no way to say "centre this paragraph", and the editor
     * needs one: an organizer writing a notice expects the alignment
     * buttons to survive a save. A column on `updates` was the other
     * option and is wrong — alignment is per-paragraph, and one column
     * cannot express "this pull quote is centred and the rest is not".
     *
     * Default (left) writes NO marker, so every post written before this
     * existed is untouched and the common case stays clean Markdown.
     *
     * The value is matched against a fixed set and used as a class name,
     * never interpolated from author input — this file's whole job is
     * that no author string reaches the output unescaped.
     */
    const aligned = /^:::(center|right)\n([\s\S]*?)\n:::$/.exec(rawBlock.trim());
    const align = aligned === null ? null : (aligned[1] as 'center' | 'right');
    const block = aligned === null ? rawBlock : (aligned[2] as string);

    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;

    const first = lines[0] as string;
    const alignAttr = align === null ? '' : ` class="md-align-${align}"`;

    const heading = /^(#{1,3})\s+(.*)$/.exec(first);
    if (heading !== null && lines.length === 1) {
      // h1 is the page title, so author headings start at h2 and the document
      // keeps a single top-level heading.
      const level = Math.min(((heading[1] as string).length ?? 1) + 1, 4);
      out.push(
        `<h${level}${alignAttr}>${inline(escapeHtml(heading[2] as string), validTournamentPaths)}</h${level}>`,
      );
      continue;
    }

    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      const items = lines
        .map(
          (l) =>
            `<li>${inline(escapeHtml(l.replace(/^\s*[-*]\s+/, '')), validTournamentPaths)}</li>`,
        )
        .join('');
      out.push(`<ul${alignAttr}>${items}</ul>`);
      continue;
    }

    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      const items = lines
        .map(
          (l) =>
            `<li>${inline(escapeHtml(l.replace(/^\s*\d+[.)]\s+/, '')), validTournamentPaths)}</li>`,
        )
        .join('');
      out.push(`<ol${alignAttr}>${items}</ol>`);
      continue;
    }

    if (lines.every((l) => /^\s*>\s?/.test(l))) {
      const text = lines.map((l) => escapeHtml(l.replace(/^\s*>\s?/, ''))).join('<br />');
      out.push(`<blockquote${alignAttr}>${inline(text, validTournamentPaths)}</blockquote>`);
      continue;
    }

    out.push(`<p${alignAttr}>${inline(lines.map(escapeHtml).join('<br />'), validTournamentPaths)}</p>`);
  }

  return out.join('\n');
}

/**
 * First paragraph as plain text, for a teaser or a meta description when the
 * author left the excerpt blank.
 */
export function excerptFrom(source: string, maxLength = 180): string {
  const text = source
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .find((b) => b !== '' && !b.startsWith('#'));

  if (text === undefined) return '';

  const plain = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  // Cut on a word boundary; a teaser that ends mid-word looks broken.
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
