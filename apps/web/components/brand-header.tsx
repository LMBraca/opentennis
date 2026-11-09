import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './brand-header.module.css';

/**
 * The brand bar.
 *
 * Open Tennis is the club; AF Pro Shop is the title sponsor, so it sits
 * beside the club mark, separated by a rule.
 *
 * The visible "Patrocinador oficial" caption is gone by request. The rule
 * still does the separating work, and the two marks are visually distinct
 * enough that neither reads as part of the other. The LINK keeps an
 * aria-label naming the relationship, so it survives for anyone on a screen
 * reader without putting a line of small caps between the logos.
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
        href={PRO_SHOP_URL}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Patrocinador oficial: AF Pro Shop"
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
/*
 * RV-9. Brand glyphs, hand-drawn as inline SVG.
 *
 * lucide-react is already a dependency but dropped brand icons, and the
 * design system bans emoji as icons — so these are the marks themselves,
 * two paths each, rather than a second icon package for two links.
 *
 * `currentColor` so they inherit the link's hover and focus states instead
 * of needing their own.
 */
function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.socialGlyph}>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.socialGlyph}>
      <path
        d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6A22 22 0 0 0 14.3 3.5c-2.4 0-4 1.45-4 4.1V9.9H7.6V13h2.7v8z"
        fill="currentColor"
      />
    </svg>
  );
}

const SOCIAL = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/opentennismx/',
    Mark: InstagramMark,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/p/Open-Tennis-Mx-61595887672200/',
    Mark: FacebookMark,
  },
] as const;

export function SiteFooter(): ReactNode {
  return (
    /*
     * RV-9. Two regions, not one run-on block.
     *
     * The club and the sponsor used to sit side by side under a single
     * hairline, which let a paid credit read as one of the club's own
     * links. They are now stacked and separated by their own rule, and the
     * whole footer sits on a tinted surface so it detaches from the page
     * above it — line weight and surface tint, which is the only depth
     * this design system allows.
     */
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <span className={styles.footerName}>Open Tennis</span>
        <nav className={styles.footerLinks} aria-label="Open Tennis">
          {SOCIAL.map(({ href, label, Mark }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.socialLink}
              aria-label={label}
              title={label}
            >
              <Mark />
            </a>
          ))}
        </nav>
      </div>

      <div className={styles.footerBase}>
        <a
          href={PRO_SHOP_URL}
          target="_blank"
          rel="noreferrer noopener"
          className={styles.footerMarkLink}
          aria-label="Patrocinador oficial: AF Pro Shop"
        >
          <Image
            src="/brand/af-pro-shop.png"
            alt="AF Pro Shop — Encordados Profesionales"
            width={1387}
            height={812}
            className={styles.footerMark}
          />
        </a>
        <span className={styles.sponsorNote}>Patrocinador oficial</span>
      </div>
    </footer>
  );
}
