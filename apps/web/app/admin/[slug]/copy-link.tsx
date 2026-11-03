'use client';

import { useState } from 'react';
import styles from './manage.module.css';

export function CopyLink({ url, open }: { readonly url: string; readonly open: boolean }) {
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
          {copied ? 'Copied' : 'Copy'}
        </button>
        <a className={styles.linkButton} href={url} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>
    </div>
  );
}
