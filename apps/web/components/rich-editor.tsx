'use client';

/**
 * RV-15 — a toolbar, for people who do not write Markdown.
 *
 * The field under this used to be a textarea with a line of help beneath
 * saying `## Heading, **bold**, *italic*`. An organizer will not learn
 * that, and should not have to.
 *
 * WHAT IS STORED DOES NOT CHANGE. The body is still Markdown and
 * `lib/markdown.ts` is still the only thing that renders it, which is what
 * keeps the security posture identical: storing the editor's HTML instead
 * would be a stored-XSS hole on a public page with a nicer toolbar on top.
 *
 * So this is a view over the same field:
 *
 *   open  — `renderMarkdown(body)` → HTML → TipTap
 *   save  — TipTap → `htmlToMarkdown()` → the same hidden input as before
 *
 * Both directions are anchored on the renderer, so the toolbar cannot
 * produce something the public page will not show. A button that silently
 * does nothing after you hit save is worse than no button.
 *
 * The extension set is derived from what the renderer supports, not from
 * TipTap's defaults — hence the disabled nodes below. Everything else it
 * ships with (code blocks, horizontal rules, strike) would serialise to
 * nothing.
 */

import { useEffect, useState } from 'react';
import { EditorContent, useEditor, Extension, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { htmlToMarkdown } from '@/lib/html-to-markdown';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './rich-editor.module.css';

/**
 * A `class` attribute on paragraphs and headings, so alignment lives where
 * the serialiser already looks for it.
 *
 * TipTap ships a TextAlign extension that writes `style="text-align: …"`.
 * That would work — html-to-markdown.ts reads both — but it means the
 * editor and the renderer spell the same idea two different ways and the
 * round trip stops being the identity function. One spelling: `md-align-*`,
 * exactly what lib/markdown.ts emits.
 */
const AlignClass = Extension.create({
  name: 'alignClass',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          class: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('class'),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes['class'] == null ? {} : { class: String(attributes['class']) },
          },
        },
      },
    ];
  },
});

/** Alignment glyphs: lines, not arrows. An arrow means "go somewhere". */
function AlignGlyph({ side }: { readonly side: 'left' | 'center' | 'right' }) {
  const rows: ReadonlyArray<readonly [number, number]> =
    side === 'left'
      ? [[2, 12], [2, 7], [2, 12], [2, 7]]
      : side === 'center'
        ? [[2, 12], [4.5, 7], [2, 12], [4.5, 7]]
        : [[2, 12], [7, 7], [2, 12], [7, 7]];
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={styles.glyph}>
      {rows.map(([x, w], i) => (
        <rect key={i} x={x} y={3 + i * 3} width={w} height="1.4" rx="0.7" fill="currentColor" />
      ))}
    </svg>
  );
}

type ToolbarCopyKey = keyof Pick<
  Dictionary,
  | 'editorHeadingTitle'
  | 'editorSubheadingTitle'
  | 'editorBoldTitle'
  | 'editorItalicTitle'
  | 'editorBulletList'
  | 'editorBulletListTitle'
  | 'editorNumberedList'
  | 'editorQuote'
  | 'editorAlignLeft'
  | 'editorAlignCenter'
  | 'editorAlignRight'
>;

interface ToolbarButton {
  readonly key: string;
  readonly label: 'H2' | 'H3' | 'B' | 'I' | 'editorBulletList' | 'editorNumberedList' | 'editorQuote';
  readonly title: ToolbarCopyKey;
  readonly run: (e: Editor) => void;
  readonly active: (e: Editor) => boolean;
}

const BUTTONS: readonly ToolbarButton[] = [
  {
    key: 'h2',
    label: 'H2',
    title: 'editorHeadingTitle',
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    key: 'h3',
    label: 'H3',
    title: 'editorSubheadingTitle',
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    active: (e) => e.isActive('heading', { level: 3 }),
  },
  {
    key: 'bold',
    label: 'B',
    title: 'editorBoldTitle',
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive('bold'),
  },
  {
    key: 'italic',
    label: 'I',
    title: 'editorItalicTitle',
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive('italic'),
  },
  {
    key: 'bullet',
    label: 'editorBulletList',
    title: 'editorBulletListTitle',
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive('bulletList'),
  },
  {
    key: 'ordered',
    label: 'editorNumberedList',
    title: 'editorNumberedList',
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive('orderedList'),
  },
  {
    key: 'quote',
    label: 'editorQuote',
    title: 'editorQuote',
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive('blockquote'),
  },
];

const ALIGNMENTS = [
  { side: 'left', copy: 'editorAlignLeft' },
  { side: 'center', copy: 'editorAlignCenter' },
  { side: 'right', copy: 'editorAlignRight' },
] as const;

export function RichEditor({
  name,
  initialHtml,
  initialMarkdown,
  label,
  dict,
}: {
  readonly name: string;
  /** `renderMarkdown(body)` from the server — the editor's starting view. */
  readonly initialHtml: string;
  /** Submitted unchanged until the editor mounts and takes over. */
  readonly initialMarkdown: string;
  readonly label: string;
  readonly dict: Dictionary;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);

  const editor = useEditor({
    /*
     * Server-rendered HTML and a contenteditable disagree about whitespace,
     * so React warns unless this renders on the client only. The hidden
     * input below carries the original value in the meantime, which means
     * a form submitted before hydration still saves what was loaded rather
     * than an empty body.
     */
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Not in the renderer's subset — a button for any of these would
        // serialise to nothing and look broken on save.
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
      }),
      AlignClass,
    ],
    content: initialHtml,
    editorProps: { attributes: { class: styles.surface ?? '', 'aria-label': label } },
    onUpdate: ({ editor: e }) => {
      setMarkdown(htmlToMarkdown(e.getHTML(), (h) => new DOMParser().parseFromString(h, 'text/html')));
    },
  });

  // Serialise once on mount too: opening a post and saving it without
  // typing should be a no-op, not a blank body.
  useEffect(() => {
    if (editor === null) return;
    setMarkdown(
      htmlToMarkdown(editor.getHTML(), (h) => new DOMParser().parseFromString(h, 'text/html')),
    );
  }, [editor]);

  return (
    <div className={styles.wrap}>
      <input type="hidden" name={name} value={markdown} />

      <div className={styles.toolbar} role="toolbar" aria-label={label}>
        {BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            className={styles.tool}
            title={dict[b.title]}
            aria-label={dict[b.title]}
            aria-pressed={editor !== null && b.active(editor)}
            data-active={editor !== null && b.active(editor) ? 'true' : undefined}
            disabled={editor === null}
            onClick={() => editor !== null && b.run(editor)}
          >
            {b.label === 'editorBulletList'
              ? `• ${dict.editorBulletList}`
              : b.label === 'editorNumberedList'
                ? `1. ${dict.editorNumberedList}`
                : b.label === 'editorQuote'
                  ? dict.editorQuote
                  : b.label}
          </button>
        ))}

        <span className={styles.spacer} />

        {/*
          Alignment. Stored as a `:::center` block directive, which
          lib/markdown.ts understands — Markdown has no native way to say
          this, and a column on the table could not express "this one
          paragraph is centred".
        */}
        {ALIGNMENTS.map(({ side, copy }) => (
          <button
            key={side}
            type="button"
            className={styles.tool}
            title={dict[copy]}
            aria-label={dict[copy]}
            disabled={editor === null}
            onClick={() => {
              if (editor === null) return;
              /*
               * Written as a class rather than through TextAlign's own
               * extension: the serialiser reads `md-align-*`, and that is
               * also exactly what the renderer emits, so a round trip is
               * the identity function instead of two spellings of the
               * same idea.
               */
              const cls = side === 'left' ? null : `md-align-${side}`;
              const node = editor.isActive('heading') ? 'heading' : 'paragraph';
              editor.chain().focus().updateAttributes(node, { class: cls }).run();
            }}
          >
            <AlignGlyph side={side} />
          </button>
        ))}
      </div>

      <EditorContent editor={editor} className={styles.editor} />
    </div>
  );
}
