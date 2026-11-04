import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './brand-header.module.css';

/**
 * The brand bar.
 *
 * Open Tennis is the club; AF Pro Shop is the title sponsor, so it sits
 * beside the club mark rather than being filed in a footer — but separated
 * by a rule and a "sponsored by" label, because a sponsor presented as a
 * co-owner of the page misrepresents both.
 *
 * `variant` picks the mark: the green logo on light surfaces, the white one
 * on the brand-green band. Two files rather than a CSS filter, because
 * filtering a multi-colour logo to white is lossy and looks it.
 */
export function BrandHeader({
  variant = 'light',
  children,
}: {
  readonly variant?: 'light' | 'onBrand';
  readonly children?: ReactNode;
}): ReactNode {
  const mark = variant === 'onBrand' ? '/brand/open-tennis-white.png' : '/brand/open-tennis.png';

  return (
    <div className={styles.bar} data-variant={variant}>
      <Link href="/" className={styles.home} aria-label="Open Tennis — home">
        <Image
          src={mark}
          alt="Open Tennis"
          width={1600}
          height={619}
          className={styles.mark}
          priority
        />
      </Link>

      <span className={styles.divider} aria-hidden="true" />

      <a
        className={styles.sponsor}
        href="https://www.instagram.com/afproshop"
        target="_blank"
        rel="noreferrer noopener"
      >
        <span className={styles.sponsorLabel}>Patrocinador oficial</span>
        <Image
          src="/brand/af-pro-shop.png"
          alt="AF Pro Shop — Encordados Profesionales"
          width={1387}
          height={812}
          className={styles.sponsorMark}
        />
      </a>

      {children !== undefined && <div className={styles.slot}>{children}</div>}
    </div>
  );
}

/**
 * Sponsor credit for the foot of a draw or results page, where the club mark
 * is already in the header and repeating it would be noise.
 */
export function SponsorFooter(): ReactNode {
  return (
    <footer className={styles.footer}>
      <span className={styles.footerLabel}>Patrocinador oficial</span>
      <a
        href="https://www.instagram.com/afproshop"
        target="_blank"
        rel="noreferrer noopener"
        className={styles.footerLink}
      >
        <Image
          src="/brand/af-pro-shop.png"
          alt="AF Pro Shop — Encordados Profesionales"
          width={1387}
          height={812}
          className={styles.footerMark}
        />
      </a>
    </footer>
  );
}
