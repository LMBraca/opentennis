'use client';

/**
 * The account menu every admin tool has: who you are, in the corner, with
 * sign-out behind it.
 *
 * This replaces two things that were each doing half the job badly — a
 * full line of masthead text reading "Sesión iniciada como name@example.com"
 * as the page's *lead*, which is the slot meant for what the page is
 * about, and a bare Sign out button sitting beside it. Neither is how a
 * signed-in app presents a session, and inventing a layout where a
 * convention exists costs the reader the thing conventions buy: knowing
 * where to look without being told.
 *
 * Keyboard and screen-reader behaviour is the part people skip. The
 * trigger is a real button with `aria-expanded` and `aria-haspopup`;
 * Escape closes and returns focus; a click anywhere outside closes. Sign
 * out stays a form POST rather than becoming a link, because signing out
 * is a state change and a GET that mutates is the bug behind every
 * "prefetch logged me out" story.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './account-menu.module.css';

export function AccountMenu({
  email,
  signOutLabel,
  accountLabel,
  signOutAction,
}: {
  readonly email: string;
  readonly signOutLabel: string;
  /** Names the control for anyone who cannot see the email beside it. */
  readonly accountLabel: string;
  readonly signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent): void => {
      if (wrapRef.current !== null && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Back to the trigger, or focus lands on <body> and the next Tab
      // starts from the top of the page.
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={accountLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {/* The initial is decorative — the email beside it is the label,
            and reading a lone letter out adds nothing. */}
        <span className={styles.avatar} aria-hidden="true">
          {email.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.email}>{email}</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <form action={signOutAction}>
            <button type="submit" className={styles.item} role="menuitem">
              {signOutLabel}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
