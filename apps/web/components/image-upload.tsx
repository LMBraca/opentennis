'use client';

/**
 * RV-16 — pick a photograph, get a URL.
 *
 * The admin forms store a URL, because `media_items.url` and
 * `updates.cover_url` always did: "whatever uploads them later only has to
 * produce a URL". This is that. The field it feeds is still an ordinary
 * hidden input submitted with the form, so the server action that saves a
 * post did not have to change at all.
 *
 * The visible URL field stays. Pasting a link to an image already hosted
 * somewhere is a legitimate thing an organizer does, and removing it to
 * make room for an upload button would be taking away a working feature in
 * the name of adding one.
 */

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import styles from './image-upload.module.css';

type Phase = { kind: 'idle' } | { kind: 'uploading' } | { kind: 'error'; message: string };

export function ImageUpload({
  name,
  value,
  label,
  uploadLabel,
  uploadingLabel,
  replaceLabel,
  removeLabel,
  altName,
  altValue,
  altLabel,
}: {
  readonly name: string;
  readonly value: string | null;
  readonly label: string;
  readonly uploadLabel: string;
  readonly uploadingLabel: string;
  readonly replaceLabel: string;
  readonly removeLabel: string;
  /** Alt text travels with the image: an empty one is an accessibility bug. */
  readonly altName: string;
  readonly altValue: string | null;
  readonly altLabel: string;
}) {
  const [url, setUrl] = useState(value ?? '');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onPick(file: File): Promise<void> {
    setPhase({ kind: 'uploading' });
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      });
      setUrl(blob.url);
      setPhase({ kind: 'idle' });
    } catch (error) {
      /*
       * Surfaced, not swallowed. The likely causes are a store that is not
       * configured yet and a file the route refused, and both are things
       * the person at the keyboard can act on.
       */
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Upload failed.',
      });
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>

      {/* The value the form actually submits, whether typed or uploaded. */}
      <input type="hidden" name={name} value={url} />

      {url !== '' && (
        /* eslint-disable-next-line @next/next/no-img-element --
           An arbitrary blob URL is not in next.config remotePatterns until
           the store exists, and a broken preview in the admin is worse than
           an unoptimised one. The public page uses next/image. */
        <img src={url} alt="" className={styles.preview} />
      )}

      <div className={styles.row}>
        <button
          type="button"
          className={styles.button}
          onClick={() => fileRef.current?.click()}
          disabled={phase.kind === 'uploading'}
        >
          {phase.kind === 'uploading' ? uploadingLabel : url === '' ? uploadLabel : replaceLabel}
        </button>

        {url !== '' && (
          <button type="button" className={styles.ghost} onClick={() => setUrl('')}>
            {removeLabel}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className={styles.file}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so picking the same file twice still fires a change.
            e.target.value = '';
            if (file !== undefined) void onPick(file);
          }}
        />
      </div>

      {/* Still typeable. An organizer with a URL should not have to download
          and re-upload the file to use it. */}
      <input
        type="url"
        className={styles.url}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
      />

      <label className={styles.alt}>
        <span className={styles.altLabel}>{altLabel}</span>
        <input type="text" name={altName} defaultValue={altValue ?? ''} className={styles.url} />
      </label>

      {phase.kind === 'error' && (
        <p className={styles.error} role="alert">
          {phase.message}
        </p>
      )}
    </div>
  );
}
