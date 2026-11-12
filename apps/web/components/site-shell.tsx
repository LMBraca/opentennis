import type { ReactNode } from 'react';
import { SiteFooter } from './brand-header';
import styles from '@/app/(site)/site.module.css';

export function SiteShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.shell} data-shell="site">
      <div className={styles.content}>{children}</div>
      <SiteFooter />
    </div>
  );
}
