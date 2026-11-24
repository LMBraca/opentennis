import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './auth.module.css';

export function AuthPage({
  backHref,
  backLabel,
  children,
  dict,
  eyebrow,
  title,
}: {
  readonly backHref: string;
  readonly backLabel: string;
  readonly children?: ReactNode;
  readonly dict: Dictionary;
  readonly eyebrow?: string | undefined;
  readonly title: string;
}) {
  return (
    <>
      <Link href="/" className={styles.logo} aria-label={dict.homeLinkLabel}>
        <Image src="/brand/open-tennis.png" alt="Open Tennis" width={109} height={42} priority />
      </Link>
      <section className={styles.card} aria-labelledby="auth-title">
        {eyebrow !== undefined && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 id="auth-title" className={styles.title}>
          {title}
        </h1>
        {children}
      </section>
      <Link href={backHref} className={styles.back}>
        {backLabel}
      </Link>
    </>
  );
}
