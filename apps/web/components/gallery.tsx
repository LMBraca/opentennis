'use client';

/**
 * Photo grid with a lightbox.
 *
 * Built on <dialog> rather than a portal and a scroll lock, because the
 * browser already does the hard parts: focus trapping, Escape to close,
 * inertness of the page behind, and returning focus to the thumbnail that
 * opened it. A hand-rolled modal gets those wrong far more often than not.
 *
 * Arrow keys move between photos, because a gallery you can only step through
 * by mouse is a gallery nobody uses on a laptop.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './gallery.module.css';

export interface GalleryItem {
  readonly id: string;
  readonly url: string;
  readonly alt: string;
  readonly caption: string | null;
}

export function Gallery({ items }: { readonly items: readonly GalleryItem[] }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const open = useCallback((i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setIndex(null);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setIndex((current) => {
        if (current === null) return null;
        // Wraps: at the last photo, Right goes back to the first rather than
        // doing nothing, which reads as a broken key.
        return (current + delta + items.length) % items.length;
      });
    },
    [items.length],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, step]);

  const current = index === null ? undefined : items[index];

  return (
    <>
      <ul className={styles.grid}>
        {items.map((item, i) => (
          <li key={item.id}>
            <button type="button" className={styles.cell} onClick={() => open(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element --
                  Remote URLs pasted by an admin; next/image would require
                  every future host in next.config.images.remotePatterns. */}
              <img src={item.url} alt={item.alt} className={styles.image} loading="lazy" />
              {item.caption !== null && item.caption !== '' && (
                <span className={styles.caption}>{item.caption}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClose={() => setIndex(null)}
        /* Clicking the backdrop closes. The check is on the target being the
           dialog ITSELF — a click on the image inside bubbles up here too,
           and closing on that would make the lightbox impossible to use. */
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        {current !== undefined && (
          <figure className={styles.figure}>
            {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
            <img src={current.url} alt={current.alt} className={styles.full} />
            {current.caption !== null && current.caption !== '' && (
              <figcaption className={styles.figCaption}>{current.caption}</figcaption>
            )}

            {items.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.nav} ${styles.prev}`}
                  onClick={() => step(-1)}
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.nav} ${styles.next}`}
                  onClick={() => step(1)}
                  aria-label="Next"
                >
                  ›
                </button>
                <span className={styles.counter}>
                  {(index ?? 0) + 1} / {items.length}
                </span>
              </>
            )}

            <button type="button" className={styles.close} onClick={close} aria-label="Close">
              ✕
            </button>
          </figure>
        )}
      </dialog>
    </>
  );
}
