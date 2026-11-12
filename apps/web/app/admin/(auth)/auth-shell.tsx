import type { ReactNode } from 'react';
import { LanguageToggle } from '@/components/language-toggle';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import styles from './auth.module.css';

export function AuthShell({
  children,
  dict,
  locale,
}: {
  readonly children?: ReactNode;
  readonly dict: Dictionary;
  readonly locale: Locale;
}) {
  return (
    <div className={styles.auth} data-shell="auth">
      <main id="main" tabIndex={-1} className={styles.authMain}>
        <div className={styles.stack}>{children}</div>
      </main>
      <footer className={`${styles.slim} vt-auth-meta`}>
        <div className={styles.slimInner}>
          <LanguageToggle active={locale} tone="light" />
          <p>{dict.footerMeta}</p>
        </div>
      </footer>
    </div>
  );
}
