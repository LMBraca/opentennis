import { logoutAction } from '@/app/admin/actions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { AccountMenu } from './account-menu';

/**
 * The admin masthead's session slot.
 *
 * Sign-out was inline on `/admin` only, so Blog and Players had no way to
 * sign out at all. It is the account menu now — who you are in the corner,
 * sign-out behind it — which is what a signed-in app looks like and what a
 * reader already knows how to find.
 *
 * The rule this settles: the masthead carries what is true on every page —
 * brand, navigation, session. A page's own action lives in the body, at
 * the top, as a filled button. See `.pageAction`.
 */
export function AdminActions({ dict, email }: {
  readonly dict: Dictionary;
  readonly email: string;
}) {
  return (
    <AccountMenu
      email={email}
      signOutLabel={dict.signOut}
      accountLabel={dict.account}
      signOutAction={logoutAction}
    />
  );
}
