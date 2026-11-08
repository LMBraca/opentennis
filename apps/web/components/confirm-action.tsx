'use client';

/**
 * OT-19 — one confirmation shape for the whole admin.
 *
 * QA found revoke, hide-tournament, reject-entry and the update
 * publish/unpublish/delete trio all firing on a single click, while
 * draw replacement and category delete each had their own careful typed
 * confirmation. The inconsistency is the problem: an organizer who learns
 * that admin buttons ask first is exactly the organizer who will click
 * Revoke to see what it does.
 *
 * An INLINE two-step reveal, not a modal. The product has one shadow token
 * and it is reserved for modals; the category ladder already established
 * this pattern, and a dialog for "are you sure" would be the only modal in
 * the admin. First click reveals the consequence and two real choices.
 *
 * Deliberately NOT a `window.confirm`: it cannot be translated, cannot be
 * styled, and on a phone it is a system sheet that looks like a browser
 * warning rather than part of the club's own tool.
 *
 * The consequence line is required. "Are you sure?" is not a safeguard —
 * it asks a question the reader cannot answer, which is the note already
 * written in player-directory.tsx. The caller has to say what will happen
 * that the button alone does not reveal.
 */

import { useState, type ReactNode } from 'react';
import styles from './confirm-action.module.css';

export function ConfirmAction({
  action,
  label,
  confirmLabel,
  consequence,
  cancelLabel,
  danger = false,
  className,
  children,
}: {
  /** A server action. Passed by reference from a server component. */
  readonly action: (formData: FormData) => void | Promise<void>;
  /** The resting button. */
  readonly label: string;
  /** The confirming button — the ACTION VERB, never "OK". */
  readonly confirmLabel: string;
  /** What happens that the button alone does not say. */
  readonly consequence: string;
  readonly cancelLabel: string;
  readonly danger?: boolean;
  readonly className?: string | undefined;
  /** Hidden fields the action needs. */
  readonly children?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className={className ?? styles.rest}
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className={styles.confirm}>
      {/* role=alert so a screen reader hears the consequence rather than
          just finding that the button changed its name. */}
      <p className={styles.consequence} role="alert">
        {consequence}
      </p>
      <div className={styles.choices}>
        <form action={action}>
          {children}
          <button
            type="submit"
            className={danger ? styles.danger : styles.go}
            /* Autofocus on the confirming control is deliberate: the
               keyboard user who pressed the first button is already here,
               and the consequence above is announced by role=alert. */
            autoFocus
          >
            {confirmLabel}
          </button>
        </form>
        <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
