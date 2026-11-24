import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill, type Dictionary } from '@/lib/i18n/dictionaries';
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

/*
 * A map pin, hand-drawn like the social marks above and for the same
 * reason: lucide-react is here but the design system bans emoji icons, and
 * two paths beat a second icon package. Decorative — the link's own label
 * says where it goes.
 */
function PinMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.pinGlyph}>
      <path
        d="M12 21.5s7-6.1 7-11.1a7 7 0 1 0-14 0c0 5 7 11.1 7 11.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.2" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

interface SocialLink {
  readonly brand: string;
  readonly network: string;
  readonly href: string;
  readonly Mark: () => ReactNode;
}

const CLUB_SOCIAL: readonly SocialLink[] = [
  {
    brand: 'Open Tennis',
    network: 'Instagram',
    href: 'https://www.instagram.com/opentennismx/',
    Mark: InstagramMark,
  },
  {
    brand: 'Open Tennis',
    network: 'Facebook',
    href: 'https://www.facebook.com/p/Open-Tennis-Mx-61595887672200/',
    Mark: FacebookMark,
  },
];

/*
 * The club's street address, as the club gave it.
 *
 * In the footer rather than a page of its own: it is the one detail a
 * player looks for on a phone after scanning a poster, and a site with two
 * public pages does not need a "contact us".
 */
const CLUB_ADDRESS = [
  'Calz. Abelardo L. Rodríguez 958',
  'Pob. Compuertas, 21000',
  'Mexicali, B.C., México',
] as const;

/*
 * The documented Google Maps URL scheme — no key, no place id, nothing to
 * expire. Built from the same lines that are displayed, so the pin and the
 * text cannot drift apart.
 */
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  CLUB_ADDRESS.join(', '),
)}`;

/* The sponsor's own accounts, both supplied by the club. */
const PRO_SHOP_SOCIAL: readonly SocialLink[] = [
  { brand: 'AF Pro Shop', network: 'Instagram', href: PRO_SHOP_URL, Mark: InstagramMark },
  {
    brand: 'AF Pro Shop',
    network: 'Facebook',
    href: 'https://www.facebook.com/61560532254259/',
    Mark: FacebookMark,
  },
];

function SocialRow({
  links,
  dict,
  label,
}: {
  readonly links: readonly SocialLink[];
  readonly dict: Dictionary;
  /** Names the group, so two social rows are distinguishable to a screen reader. */
  readonly label: string;
}) {
  if (links.length === 0) return null;
  return (
    <nav className={styles.socialRow} aria-label={label}>
      {links.map(({ href, brand, network, Mark }) => {
        // "Open Tennis en Instagram" / "Open Tennis on Instagram" — the
        // labels were Spanish-only while the rest of the page followed the
        // reader.
        const text = fill(dict.socialOn, { brand, network });
        return (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.socialLink}
            aria-label={text}
            title={text}
          >
            <Mark />
          </a>
        );
      })}
    </nav>
  );
}

export async function SiteFooter(): Promise<ReactNode> {
  /*
   * Resolves its own locale rather than taking a prop. Three call sites,
   * all server components, and none of them had a reason to know the
   * footer needs words — the social labels were hardcoded Spanish while
   * every other string on the page followed the reader.
   */
  const dict = dictionary(await currentLocale());
  const year = new Date().getFullYear();

  return (
    /*
     * Three columns across the measure, then a rule, then the fine print.
     *
     * Two columns could not be made to work here and the reason is
     * arithmetic, not taste: the only two things with real width are the
     * logos, and two blocks of ~120px cannot hold a 1150px line. Pushed
     * apart they stranded a thousand pixels between them; pulled together
     * they left the same hole on the outside; shrink-wrapped they became a
     * small island in a wide band.
     *
     * A third column fixes it by giving the middle something to BE. The
     * address moves out of the club's stack into a column of its own, so
     * the eye travels mark → place → mark with even air between, and the
     * outer two sit on the container's edges where the rule and the fine
     * print also end. Every element now has an edge it agrees with.
     */
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          {/* 1 — the club */}
          <div className={styles.club}>
            <Link href="/" className={styles.home} aria-label={dict.footerHome}>
              <Image
                src="/brand/open-tennis-white.png"
                alt="Open Tennis"
                width={1600}
                height={619}
                className={styles.mark}
              />
            </Link>
            <SocialRow links={CLUB_SOCIAL} dict={dict} label="Open Tennis" />
          </div>

          {/* 2 — where it is */}
          <div className={styles.location}>
            <h2 className={styles.columnTitle}>{dict.visitUs}</h2>
            {/*
              <address> is the element for contact details; the link inside
              makes it actionable. A player standing in a car park wants
              directions, not a string to retype.
            */}
            <address className={styles.address}>
              <a
                className={styles.addressLink}
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`${CLUB_ADDRESS.join(', ')} — ${dict.openInMaps}`}
              >
                <PinMark />
                <span className={styles.addressLines}>
                  {CLUB_ADDRESS.map((line) => (
                    <span key={line} className={styles.addressLine}>
                      {line}
                    </span>
                  ))}
                </span>
              </a>
            </address>
          </div>

          {/* 3 — the partner */}
          <div className={styles.partner}>
            <a
              href={PRO_SHOP_URL}
              target="_blank"
              rel="noreferrer noopener"
              className={styles.sponsor}
              aria-label={dict.officialSponsor}
            >
              <Image
                src="/brand/af-pro-shop.png"
                alt="AF Pro Shop — Encordados Profesionales"
                width={1387}
                height={812}
                className={styles.sponsorMark}
              />
            </a>
            <SocialRow links={PRO_SHOP_SOCIAL} dict={dict} label="AF Pro Shop" />
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.copyright}>© {year} Open Tennis</p>
          <p className={styles.rights}>{dict.rightsReserved}</p>
        </div>
      </div>
    </footer>
  );
}
