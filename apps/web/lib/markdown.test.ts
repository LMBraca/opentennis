/**
 * The interesting tests here are the injection ones.
 *
 * This file is the only thing standing between an admin textarea and
 * dangerouslySetInnerHTML on a public page, so "does bold work" is table
 * stakes and "can an author emit a script tag" is the actual contract.
 */

import { describe, expect, it } from 'vitest';
import { excerptFrom, renderMarkdown } from './markdown';

describe('renderMarkdown — structure', () => {
  it('wraps a plain block in a paragraph', () => {
    expect(renderMarkdown('Entries close Friday.')).toBe('<p>Entries close Friday.</p>');
  });

  it('keeps single newlines as line breaks', () => {
    // "Saturday 9am\nSunday 10am" as one run-on line is never what was meant.
    expect(renderMarkdown('Saturday 9am\nSunday 10am')).toBe(
      '<p>Saturday 9am<br />Sunday 10am</p>',
    );
  });

  it('separates blocks on blank lines', () => {
    expect(renderMarkdown('One.\n\nTwo.')).toBe('<p>One.</p>\n<p>Two.</p>');
  });

  it('starts author headings at h2, so the page keeps one h1', () => {
    expect(renderMarkdown('# Finals day')).toBe('<h2>Finals day</h2>');
    expect(renderMarkdown('## Schedule')).toBe('<h3>Schedule</h3>');
    expect(renderMarkdown('### Courts')).toBe('<h4>Courts</h4>');
  });

  it('renders bullet and numbered lists', () => {
    expect(renderMarkdown('- A\n- B')).toBe('<ul><li>A</li><li>B</li></ul>');
    expect(renderMarkdown('1. A\n2. B')).toBe('<ol><li>A</li><li>B</li></ol>');
  });

  it('renders emphasis and code', () => {
    expect(renderMarkdown('**bold** and *italic* and `code`')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>',
    );
  });

  it('renders a blockquote', () => {
    expect(renderMarkdown('> Rain delay.')).toBe('<blockquote>Rain delay.</blockquote>');
  });

  it('ignores trailing and leading whitespace', () => {
    expect(renderMarkdown('\n\n  Hello.  \n\n')).toBe('<p>Hello.</p>');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   \n  \n ')).toBe('');
  });
});

describe('renderMarkdown — links', () => {
  it('marks external links target=_blank with a safe rel', () => {
    expect(renderMarkdown('[AF](https://example.com)')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noreferrer noopener">AF</a></p>',
    );
  });

  it('leaves internal links in the same tab', () => {
    expect(renderMarkdown('[Draws](/t/open-26)')).toBe('<p><a href="/t/open-26">Draws</a></p>');
  });

  it('preserves query strings', () => {
    // The href is HTML-escaped before scheme checking, so &amp; has to be
    // decoded on the way back out or every multi-param URL breaks.
    expect(renderMarkdown('[x](https://e.com/?a=1&b=2)')).toContain(
      'href="https://e.com/?a=1&amp;b=2"',
    );
  });

  it('refuses javascript: and renders the source as inert text', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    // The payload staying VISIBLE is the point: it is not an href, so it
    // cannot run, and the author can see their link did not work. Asserting
    // the string is absent would be asserting the wrong contract.
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href');
    expect(html).toBe('<p>[click](javascript:alert(1))</p>');
  });

  it('refuses data: URLs', () => {
    expect(renderMarkdown('[x](data:text/html,<script>alert(1)</script>)')).not.toContain('<a');
  });

  it('refuses protocol-relative URLs', () => {
    expect(renderMarkdown('[x](//evil.com)')).not.toContain('<a');
  });

  it('is not fooled by whitespace or case in the scheme', () => {
    expect(renderMarkdown('[x](  JaVaScRiPt:alert(1))')).not.toContain('<a');
  });
});

describe('renderMarkdown — injection', () => {
  it('escapes a script tag', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes an img onerror payload', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('cannot break out of an href attribute', () => {
    // A quote inside the URL must not be able to close the attribute and
    // start an event handler.
    const html = renderMarkdown('[x](https://e.com/" onmouseover="alert(1))');
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).not.toMatch(/<a[^>]*\son\w+=/);
  });

  it('escapes markup inside a heading', () => {
    expect(renderMarkdown('# <b>hi</b>')).toBe('<h2>&lt;b&gt;hi&lt;/b&gt;</h2>');
  });

  it('escapes markup inside a list item', () => {
    expect(renderMarkdown('- <b>hi</b>')).toBe('<ul><li>&lt;b&gt;hi&lt;/b&gt;</li></ul>');
  });

  it('escapes markup in a link label', () => {
    const html = renderMarkdown('[<b>x</b>](https://e.com)');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('never emits a tag that is not in the allowed set', () => {
    const nasty = [
      '<iframe src=//evil.com>',
      '<style>body{display:none}</style>',
      '<svg/onload=alert(1)>',
      '<a href="javascript:alert(1)">x</a>',
      '<!-- comment -->',
      '<form><input name=x></form>',
    ].join('\n\n');

    const html = renderMarkdown(nasty);
    const tags = [...html.matchAll(/<(\/?[a-z][a-z0-9]*)/gi)].map((m) =>
      (m[1] as string).replace('/', '').toLowerCase(),
    );
    const allowed = new Set([
      'p',
      'br',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'code',
      'blockquote',
      'a',
    ]);
    for (const tag of tags) expect(allowed.has(tag)).toBe(true);
  });

  it('escapes ampersands exactly once', () => {
    // Double-escaping shows up as "&amp;amp;" on the page, which readers see.
    expect(renderMarkdown('Fish & chips')).toBe('<p>Fish &amp; chips</p>');
  });
});

describe('excerptFrom', () => {
  it('takes the first paragraph', () => {
    expect(excerptFrom('# Title\n\nFirst para.\n\nSecond.')).toBe('First para.');
  });

  it('strips markup', () => {
    expect(excerptFrom('**Bold** and [a link](https://e.com).')).toBe('Bold and a link.');
  });

  it('truncates on a word boundary', () => {
    const long = `${'word '.repeat(60)}`;
    const out = excerptFrom(long, 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out).not.toMatch(/wo…$/); // not cut mid-word
  });

  it('returns empty string when there is no prose', () => {
    expect(excerptFrom('')).toBe('');
    expect(excerptFrom('# Only a heading')).toBe('');
  });
});
