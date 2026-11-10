'use client';

/**
 * Top-level navigation for the admin, in the masthead on every admin page.
 *
 * It did not exist. `/admin` rendered its own row of buttons in the body
 * and the sub-pages rendered a "Back to tournaments" link and nothing
 * else, so opening Blog or Players made the top-level navigation vanish
 * and the only way across was back through the home page. Reported as the
 * tabs disappearing, which is exactly what it was.
 *
 * Same shape as `SiteNav` on the public side — three links, a painted
 * underline on the active one, no drawer for something that fits on one
 * line. The "line, not box" rule the brackets follow.
 *
 * Capability-gated, so a scorekeeper is not shown doors that will turn
 * them away. `admin:view` is implied by being here at all.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './site-nav.module.css';

export function AdminNav({
  dict,
  canManageContent,
  canMergePlayers,
  canInviteAdmins,
}: {
  readonly dict: Dictionary;
  readonly canManageContent: boolean;
  readonly canMergePlayers: boolean;
  readonly canInviteAdmins: boolean;
}): React.ReactElement {
  const pathname = usePathname();

  const links = [
    { href: '/admin', label: dict.tournaments, show: true },
    { href: '/admin/updates', label: dict.updates, show: canManageContent },
    { href: '/admin/players', label: dict.players, show: canMergePlayers },
    { href: '/admin/team', label: dict.adminTeam, show: canInviteAdmins },
  ].filter((l) => l.show);

  /*
   * `/admin` must match exactly or it would light up on every admin page,
   * since every one of them is under it. The others match their subtree so
   * editing a single post still highlights Blog.
   */
  const isActive = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <nav className={styles.nav} data-variant="onBrand" aria-label={dict.adminEyebrow}>
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
