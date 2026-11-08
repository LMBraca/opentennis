'use client';

import type { Dictionary } from '@/lib/i18n/dictionaries';
import { CopyButton } from '@/components/copy-button';
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
  return (
    <div className={styles.linkBox} data-open={open}>
      {/* The URL itself is the link. An arrow beside it is easy to miss. */}
      <a className={styles.linkUrl} href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
      <div className={styles.linkActions}>
        {/* OT-10: the clipboard behaviour, and its spoken confirmation,
            moved to components/copy-button so the scorekeeper page uses
            exactly the same one. */}
        <CopyButton
          value={url}
          label={dict.copy}
          copiedLabel={dict.copied}
          className={styles.linkButton}
        />
        <a className={styles.linkButton} href={url} target="_blank" rel="noreferrer">
          {dict.openLink}
        </a>
      </div>
    </div>
  );
}
