import { logoutAction } from '@/app/admin/actions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from '@/app/admin/admin.module.css';

/**
 * The admin masthead's utility slot: sign out, and nothing else.
 *
 * It was inline on `/admin` only, so Blog and Players had no way to sign
 * out at all — you had to navigate home first. The Blog page instead put
 * its *primary* action here, styled as the sign-out link, which is how
 * "Write an update" ended up looking like the least important control on
 * a page whose whole job is writing.
 *
 * The rule this settles: the masthead carries things that are true
 * everywhere — brand, navigation, session. A page's own action lives in
 * the body, at the top, as a filled button. See `.pageAction`.
 */
export function AdminActions({ dict }: { readonly dict: Dictionary }) {
  return (
    <form action={logoutAction}>
      <button className={styles.signOut} type="submit">
        {dict.signOut}
      </button>
    </form>
  );
}
