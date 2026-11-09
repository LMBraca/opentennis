'use client';

/**
 * SCR-8 — the spectator's live subscription, and an honest account of it.
 *
 * Honest is the whole point. A page that quietly stops receiving updates but
 * keeps looking live is worse than one that never claimed to be live: someone
 * at the clubhouse reads a stale score off a phone and tells the court the
 * wrong thing. So this says only what it actually knows — and until the
 * stream has opened once, it says nothing at all rather than flashing a
 * claim it cannot yet support.
 *
 * NO optic yellow here, deliberately. `--optic-500` means "a match is live
 * right now" and nothing else; an open EventSource is not a match. The dot
 * is ink, and it is the match nodes that stay entitled to the brand's one
 * loud colour.
 *
 * On a change it calls `router.refresh()` rather than patching scores into
 * the DOM. That re-runs the server render, so the bracket has one renderer
 * instead of a server one plus a client one that must agree with it forever.
 *
 * Labels arrive as plain strings. Functions cannot cross the server→client
 * boundary in this app and the build does not catch it — see the note on
 * `enteredDoubles` in the dictionary.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './live-updates.module.css';

type Status = 'idle' | 'live' | 'reconnecting' | 'stopped';

export interface LiveUpdatesLabels {
  readonly live: string;
  readonly reconnecting: string;
  readonly stopped: string;
}

export function LiveUpdates({
  href,
  labels,
}: {
  readonly href: string;
  readonly labels: LiveUpdatesLabels;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    let source: EventSource | null = null;
    let disposed = false;

    const close = (): void => {
      source?.close();
      source = null;
    };

    const open = (): void => {
      if (disposed || source !== null) return;
      const next = new EventSource(href);
      source = next;

      next.onopen = () => {
        if (!disposed) setStatus('live');
      };

      next.addEventListener('change', () => {
        if (!disposed) router.refresh();
      });

      // The server could still reach us but could not reach the database.
      // The socket is fine; the DATA is not, and that is what to report.
      next.addEventListener('stale', () => {
        if (!disposed) setStatus('reconnecting');
      });

      next.onerror = () => {
        if (disposed) return;
        // EventSource retries by itself unless it has given up for good.
        setStatus(next.readyState === EventSource.CLOSED ? 'stopped' : 'reconnecting');
      };
    };

    /*
     * A hidden tab holds a serverless invocation open for nobody. Drop the
     * stream when the page is backgrounded and pick it up on return — with
     * an immediate refresh, because whatever happened while we were away was
     * missed by definition.
     */
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        close();
        setStatus('idle');
      } else {
        open();
        router.refresh();
      }
    };

    if (document.visibilityState === 'visible') open();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      close();
    };
  }, [href, router]);

  // Nothing to say before the first connection, and nothing to say while
  // backgrounded. Silence beats an unearned claim.
  if (status === 'idle') return null;

  const label =
    status === 'live'
      ? labels.live
      : status === 'reconnecting'
        ? labels.reconnecting
        : labels.stopped;

  /*
   * Silent when it is working, loud when it is not.
   *
   * "Actualización automática" was a working thing announcing that it
   * works — a line of text on every draw page that no reader ever needed
   * to act on. The dot already says live. Reconnecting and stopped are
   * the opposite: they mean the scores on screen may now be stale, which
   * is the one thing worth interrupting someone to say.
   *
   * The label survives for screen readers in the live state rather than
   * being dropped. A role="status" region containing only an aria-hidden
   * dot announces nothing at all, and "is this page still updating" is a
   * question a non-sighted reader has just as much as anyone.
   */
  return (
    <p className={styles.strip} data-status={status} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      <span className={status === 'live' ? styles.quiet : undefined}>{label}</span>
    </p>
  );
}
