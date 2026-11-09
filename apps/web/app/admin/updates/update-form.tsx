'use client';

/**
 * The update editor.
 *
 * One form for create and edit; the only difference is which action it posts
 * to and whether an id travels with it. Two near-identical forms drift, and
 * the drift is always a field someone forgot to add to the second one.
 */

import { useActionState } from 'react';
import Link from 'next/link';
import type { UpdateFormState } from './update-actions';
import { ImageUpload } from '@/components/image-upload';
import { RichEditor } from '@/components/rich-editor';
import styles from './update-form.module.css';

export interface TournamentOption {
  readonly id: string;
  readonly name: string;
}

export interface UpdateInitial {
  readonly id?: string;
  readonly title: string;
  readonly excerpt: string;
  readonly body: string;
  /** RV-15: the body pre-rendered, so the editor opens on it. */
  readonly bodyHtml: string;
  readonly coverUrl: string;
  readonly coverAlt: string;
  readonly tournamentId: string;
  readonly media: string;
  readonly published: boolean;
}

export function UpdateForm({
  action,
  initial,
  tournaments,
  submitLabel,
}: {
  readonly action: (
    prev: UpdateFormState,
    form: FormData,
  ) => Promise<UpdateFormState>;
  readonly initial: UpdateInitial;
  readonly tournaments: readonly TournamentOption[];
  readonly submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={styles.form}>
      {initial.id !== undefined && <input type="hidden" name="id" value={initial.id} />}

      {state.error !== undefined && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <input
          name="title"
          defaultValue={initial.title}
          className={styles.input}
          required
          maxLength={160}
          autoComplete="off"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Summary</span>
        <textarea
          name="excerpt"
          defaultValue={initial.excerpt}
          className={styles.textarea}
          rows={2}
          maxLength={280}
        />
        <span className={styles.hint}>
          Shown on the updates list and the home page. Leave blank to use the first paragraph.
        </span>
      </label>

      {/*
        RV-15. The Markdown cheat sheet is gone with the textarea it
        explained. The body is still STORED as Markdown — the editor opens
        on renderMarkdown() and saves through htmlToMarkdown(), so
        lib/markdown.ts remains the only thing that turns stored text into
        HTML and the XSS posture is unchanged.
      */}
      <div className={styles.field}>
        <span className={styles.label}>Body</span>
        <RichEditor
          name="body"
          initialMarkdown={initial.body}
          initialHtml={initial.bodyHtml}
          label="Body"
        />
      </div>

      {/*
        RV-16. Upload replaces typing a URL as the default path, but does
        not remove it: an organizer with a link to an image already online
        should not have to download and re-upload it.
      */}
      <ImageUpload
        name="coverUrl"
        value={initial.coverUrl === '' ? null : initial.coverUrl}
        label="Cover image"
        uploadLabel="Upload image"
        uploadingLabel="Uploading…"
        replaceLabel="Replace image"
        removeLabel="Remove"
        altName="coverAlt"
        altValue={initial.coverAlt === '' ? null : initial.coverAlt}
        altLabel="Cover description — what the photo shows"
      />

      <label className={styles.field}>
        <span className={styles.label}>Photos</span>
        <textarea
          name="media"
          defaultValue={initial.media}
          className={styles.textarea}
          rows={6}
          placeholder="https://…/photo.jpg | Two players at the net | Final, C+ singles"
        />
        <span className={styles.hint}>
          One photo per line: <code>url | description | caption</code>. The description is read
          aloud by screen readers; the caption is printed under the photo. Both are optional, but
          a gallery with no descriptions is unusable to anyone who cannot see it.
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Related tournament</span>
        <select
          name="tournamentId"
          defaultValue={initial.tournamentId}
          className={styles.input}
        >
          <option value="">None</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.check}>
        <input type="checkbox" name="publish" defaultChecked={initial.published} />
        <span>
          Publish to the public site
          <span className={styles.hint}>
            Unchecked saves a draft, visible only here. Publishing an already-published post keeps
            its original date, so fixing a typo does not move it back to the top.
          </span>
        </span>
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href="/admin/updates" className={styles.cancel}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
