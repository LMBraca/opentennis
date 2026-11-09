import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { dictionary } from '@/lib/i18n/dictionaries';
import { currentLocale } from '@/lib/i18n/server';
import styles from './brand-header.module.css';

/**
 * The brand bar.
 *
 * Open Tennis is the club; AF Pro Shop is the title sponsor, so it sits
 * beside the club mark, separated by a rule.
 *
 * The two marks are visually distinct enough that neither reads as part of
 * the other. The sponsor link is named in the current locale.
 *
 * `variant` picks the mark: the green logo on light surfaces, the white one
 * on the brand-green band. Two files rather than a CSS filter, because
 * filtering a multi-colour logo to white is lossy and looks it.
 */
/* One place, so the header link and both footer links cannot drift. */
const PRO_SHOP_URL = 'https://www.instagram.com/afproshop';

export function BrandHeader({
  variant = 'light',
  children,
  sponsorLabel,
}: {
  readonly variant?: 'light' | 'onBrand';
  readonly children?: ReactNode;
  readonly sponsorLabel: string;
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
        href={PRO_SHOP_URL}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={sponsorLabel}
      >
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
 * Where the club actually lives online.
 *
 * Most of this club's audience finds a draw through a link in an Instagram
 * story, so the foot of every page sends them back the other way. Two
 * columns: the club's own accounts on the left, the sponsor's mark on the
 * right — same separation as the masthead, so the sponsor is credited
 * without being presented as the club.
 *
 * Named SiteFooter rather than SponsorFooter now that it carries more than a
 * sponsor credit; a component whose name describes a third of what it does
 * is how the next person puts the wrong thing in it.
 */
const SOCIAL = [
  { label: 'Instagram', href: 'https://www.instagram.com/opentennismx/' },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/p/Open-Tennis-Mx-61595887672200/',
  },
] as const;

export async function SiteFooter(): Promise<ReactNode> {
  const labels = dictionary(await currentLocale());
  return (
    <footer className={styles.footer}>
      <div className={styles.footerClub}>
        <span className={styles.footerName}>Open Tennis</span>
        <nav className={styles.footerLinks} aria-label="Open Tennis">
          {SOCIAL.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.footerLink}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className={styles.footerSponsor}>
        <a
          aria-label={labels.proShopInstagram}
          href={PRO_SHOP_URL}
          target="_blank"
          rel="noreferrer noopener"
          className={styles.footerMarkLink}
        >
          <Image
            src="/brand/af-pro-shop.png"
            alt="AF Pro Shop — Encordados Profesionales"
            width={1387}
            height={812}
            className={styles.footerMark}
          />
          <span className={styles.footerLink}>{labels.proShopInstagram}</span>
        </a>
      </div>
    </footer>
  );
}
