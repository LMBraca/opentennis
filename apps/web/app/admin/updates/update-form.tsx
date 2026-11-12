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
import type { Dictionary } from '@/lib/i18n/dictionaries';
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
  dict,
}: {
  readonly action: (
    prev: UpdateFormState,
    form: FormData,
  ) => Promise<UpdateFormState>;
  readonly initial: UpdateInitial;
  readonly tournaments: readonly TournamentOption[];
  readonly submitLabel: string;
  readonly dict: Dictionary;
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
        <span className={styles.label}>{dict.updateTitleLabel}</span>
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
        <span className={styles.label}>{dict.updateSummaryLabel}</span>
        <textarea
          name="excerpt"
          defaultValue={initial.excerpt}
          className={styles.textarea}
          rows={2}
          maxLength={280}
        />
        <span className={styles.hint}>
          {dict.updateSummaryHint}
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
        <span className={styles.label}>{dict.updateBodyLabel}</span>
        <RichEditor
          name="body"
          initialMarkdown={initial.body}
          initialHtml={initial.bodyHtml}
          label={dict.updateBodyLabel}
          dict={dict}
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
        label={dict.coverImageLabel}
        uploadLabel={dict.uploadImageLabel}
        uploadingLabel={dict.uploadingImage}
        replaceLabel={dict.replaceImage}
        removeLabel={dict.removeImage}
        altName="coverAlt"
        altValue={initial.coverAlt === '' ? null : initial.coverAlt}
        altLabel={dict.coverDescriptionLabel}
      />

      <label className={styles.field}>
        <span className={styles.label}>{dict.photos}</span>
        <textarea
          name="media"
          defaultValue={initial.media}
          className={styles.textarea}
          rows={6}
          placeholder={dict.photosPlaceholder}
        />
        <span className={styles.hint}>{dict.photosHint}</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{dict.relatedTournament}</span>
        <select
          name="tournamentId"
          defaultValue={initial.tournamentId}
          className={styles.input}
        >
          <option value="">{dict.relatedTournamentNone}</option>
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
          {dict.publishToSite}
          <span className={styles.hint}>{dict.publishToSiteHint}</span>
        </span>
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? dict.saving : submitLabel}
        </button>
        <Link href="/admin/updates" className={styles.cancel}>
          {dict.cancel}
        </Link>
      </div>
    </form>
  );
}
