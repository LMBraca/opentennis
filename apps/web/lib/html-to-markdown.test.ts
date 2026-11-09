import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { htmlToMarkdown } from './html-to-markdown';
import { renderMarkdown } from './markdown';

const parse = (html: string): Document => {
  const w = new Window();
  w.document.body.innerHTML = html;
  return w.document as unknown as Document;
};

const md = (html: string): string => htmlToMarkdown(html, parse);

describe('htmlToMarkdown', () => {
  it('keeps paragraphs as blocks', () => {
    expect(md('<p>One</p><p>Two</p>')).toBe('One\n\nTwo');
  });

  it('carries bold, italic and links', () => {
    expect(md('<p><strong>a</strong> <em>b</em> <a href="/x">c</a></p>')).toBe(
      '**a** *b* [c](/x)',
    );
  });

  it('shifts headings back up, because the renderer shifts them down', () => {
    // renderMarkdown turns `## x` into <h3>; coming back must undo that or
    // every save demotes every heading one level.
    expect(md('<h3>Resultados</h3>')).toBe('## Resultados');
  });

  it('round-trips a heading through the renderer unchanged', () => {
    const source = '## Resultados';
    expect(md(renderMarkdown(source))).toBe(source);
  });

  it('writes both list kinds', () => {
    expect(md('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b');
    expect(md('<ol><li>a</li><li>b</li></ol>')).toBe('1. a\n2. b');
  });

  it('writes alignment as a directive and left as nothing', () => {
    expect(md('<p style="text-align: center">hi</p>')).toBe(':::center\nhi\n:::');
    expect(md('<p class="md-align-right">hi</p>')).toBe(':::right\nhi\n:::');
    expect(md('<p>hi</p>')).toBe('hi');
  });

  it('round-trips alignment through the renderer', () => {
    const source = ':::center\nFinals on Sunday\n:::';
    expect(md(renderMarkdown(source))).toBe(source);
  });

  it('escapes characters that would read back as markup', () => {
    expect(md('<p>2 * 3 [note]</p>')).toBe('2 \\* 3 \\[note\\]');
  });

  it('flattens a tag the renderer cannot produce rather than keeping it', () => {
    // The point of serialising to Markdown: no HTML survives to the store.
    expect(md('<p><span onclick="x()">hi</span></p>')).toBe('hi');
    expect(md('<table><tr><td>hi</td></tr></table>')).not.toContain('<');
  });

  it('drops an empty paragraph', () => {
    expect(md('<p>a</p><p></p><p>b</p>')).toBe('a\n\nb');
  });

  it('treats a link with no href as plain text', () => {
    expect(md('<p><a href="">c</a></p>')).toBe('c');
  });
});
