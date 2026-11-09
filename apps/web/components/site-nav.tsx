'use client';

/**
 * Top-level navigation for the public site.
 *
 * Three destinations is not enough to justify a menu, a drawer, or a
 * hamburger — they are three links that fit on one line on a 320px phone.
 * The active one is marked with a painted underline rather than a filled
 * pill, which is the same "line, not box" rule the brackets follow.
 *
 * NOT optic yellow. That colour means "live right now" and nothing else;
 * using it for "you are here" would make the one signal that matters
 * ambiguous.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './site-nav.module.css';

export function SiteNav({
  dict,
  variant = 'onBrand',
}: {
  readonly dict: Dictionary;
  readonly variant?: 'light' | 'onBrand';
}): React.ReactElement {
  const pathname = usePathname();

  const links = [
    { href: '/', label: dict.tournaments },
    { href: '/blog', label: dict.updates },
    { href: '/media', label: dict.media },
    { href: '/search', label: dict.searchTitle },
  ] as const;

  // "/" must match exactly or it would light up on every page; the others
  // match their subtree so an article still highlights Updates.
  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' || pathname.startsWith('/t/') : pathname.startsWith(href);

  return (
    <nav className={styles.nav} data-variant={variant} aria-label={dict.tournaments}>
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={styles.link}
            data-active={active ? 'true' : undefined}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
