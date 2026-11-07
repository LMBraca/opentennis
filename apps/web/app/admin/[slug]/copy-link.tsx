'use client';

import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './manage.module.css';

export function CopyLink({
  url,
  open,
  dict,
}: {
  readonly url: string;
  readonly open: boolean;
  readonly dict: Dictionary;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // Selecting the text is the fallback, and the URL is already visible.
      setCopied(false);
    }
  };

  return (
    <div className={styles.linkBox} data-open={open}>
      {/* The URL itself is the link. An arrow beside it is easy to miss. */}
      <a className={styles.linkUrl} href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
      <div className={styles.linkActions}>
        <button type="button" className={styles.linkButton} onClick={copy}>
          {copied ? dict.copied : dict.copy}
        </button>
        <a className={styles.linkButton} href={url} target="_blank" rel="noreferrer">
          {dict.openLink}
        </a>
      </div>
    </div>
  );
}
