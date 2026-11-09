/**
 * RV-15 — the editor's HTML, back to the Markdown subset we store.
 *
 * THE STORED FORMAT DOES NOT CHANGE. The body stays Markdown and
 * `lib/markdown.ts` stays the only thing that turns it into HTML, which is
 * what keeps the XSS posture exactly where it was: an admin textarea that
 * accepted HTML would be a stored-XSS hole on a public page, and a rich
 * editor that stored its own HTML is the same hole with a nicer toolbar.
 *
 * So the editor is a *view*. It opens on `renderMarkdown(body)` and saves
 * through here. Both directions are anchored on the renderer, which means
 * the editor cannot produce a construct the public page will not render —
 * the failure mode where a toolbar button silently does nothing once you
 * hit save.
 *
 * Pure, and in `lib`, because the editor itself is a client component
 * behind a session and this is the part that has to be right.
 */

/** The alignment directive taught to lib/markdown.ts. Left writes nothing. */
type Align = 'center' | 'right' | null;

function alignOf(el: Element): Align {
  const style = el.getAttribute('style') ?? '';
  const cls = el.getAttribute('class') ?? '';
  if (style.includes('text-align: center') || cls.includes('md-align-center')) return 'center';
  if (style.includes('text-align: right') || cls.includes('md-align-right')) return 'right';
  return null;
}

function wrap(body: string, align: Align): string {
  return align === null ? body : `:::${align}\n${body}\n:::`;
}

/** Characters that would otherwise be read back as markup. */
function escapeText(text: string): string {
  return text.replace(/([\\*_[\]])/g, '\\$1');
}

function inlineOf(node: Node): string {
  if (node.nodeType === 3) return escapeText(node.textContent ?? '');
  if (node.nodeType !== 1) return '';

  const el = node as Element;
  const inner = [...el.childNodes].map(inlineOf).join('');
  if (inner === '') return '';

  switch (el.tagName.toLowerCase()) {
    case 'strong':
    case 'b':
      return `**${inner}**`;
    case 'em':
    case 'i':
      return `*${inner}*`;
    case 'a': {
      const href = el.getAttribute('href') ?? '';
      // A link with no destination is just text; emitting `[x]()` would
      // round-trip into a dead link.
      return href === '' ? inner : `[${inner}](${href})`;
    }
    case 'br':
      return '\n';
    default:
      return inner;
  }
}

function listOf(el: Element, ordered: boolean): string {
  return [...el.children]
    .filter((li) => li.tagName.toLowerCase() === 'li')
    .map((li, i) => `${ordered ? `${i + 1}.` : '-'} ${inlineOf(li).trim()}`)
    .join('\n');
}

/**
 * `html` must come from the editor, not from an author's clipboard as raw
 * markup — anything this does not recognise is flattened to its text, so an
 * unsupported tag loses its formatting rather than surviving as HTML.
 */
export function htmlToMarkdown(html: string, parse: (h: string) => Document): string {
  const doc = parse(html);
  const blocks: string[] = [];

  for (const el of [...doc.body.children]) {
    const tag = el.tagName.toLowerCase();
    const align = alignOf(el);
    const text = inlineOf(el).trim();

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      if (text === '') continue;
      /*
       * The renderer shifts author headings down by one — h1 is the page
       * title — so `## x` renders as <h3>. Coming back the other way has
       * to shift up by the same one or every save demotes every heading.
       */
      const level = Math.max(1, Math.min(3, Number(tag.slice(1)) - 1));
      blocks.push(wrap(`${'#'.repeat(level)} ${text}`, align));
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const body = listOf(el, tag === 'ol');
      if (body !== '') blocks.push(wrap(body, align));
      continue;
    }

    if (tag === 'blockquote') {
      const body = [...el.children]
        .map((child) => inlineOf(child).trim())
        .filter((line) => line !== '')
        .map((line) => `> ${line}`)
        .join('\n');
      if (body !== '') blocks.push(wrap(body, align));
      continue;
    }

    // Everything else is a paragraph. An empty one is a blank line the
    // author pressed Enter on, and Markdown has no way to keep it.
    if (text !== '') blocks.push(wrap(text, align));
  }

  return blocks.join('\n\n');
}
