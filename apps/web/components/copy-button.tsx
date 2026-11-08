'use client';

/**
 * OT-10 — copy a URL, and say so out loud.
 *
 * Extracted from `CopyLink` when the scorekeeper page needed the same
 * behaviour next to a selectable field rather than next to a link: the
 * clipboard call, the two-second "Copied" window and the failure path are
 * all the same, and a second copy of them is a second thing to get wrong.
 *
 * The confirmation is announced with `role="status"`. A button whose label
 * flickers from "Copiar" to "Copiado" tells a sighted user it worked and
 * tells a screen-reader user nothing at all, and "did that copy?" is the
 * whole question — the organizer is usually standing at a desk about to
 * read the link out or paste it into WhatsApp.
 */

import { useState } from 'react';
import styles from './copy-button.module.css';

export function CopyButton({
  value,
  label,
  copiedLabel,
  className,
}: {
  readonly value: string;
  readonly label: string;
  readonly copiedLabel: string;
  readonly className?: string | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /*
       * Clipboard access can be refused — an insecure origin, a denied
       * permission, an older in-app browser. Staying silent is right: the
       * URL is visible and selectable beside this button, so the organizer
       * still has a way through, and claiming success would be worse than
       * saying nothing.
       */
      setCopied(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => void copy()}>
        {copied ? copiedLabel : label}
      </button>
      {/*
        Always rendered, so assistive tech is already watching this node
        when it fills. A live region that appears at the same moment as its
        text is frequently missed.
      */}
      <span className={styles.announce} role="status">
        {copied ? copiedLabel : ''}
      </span>
    </>
  );
}
