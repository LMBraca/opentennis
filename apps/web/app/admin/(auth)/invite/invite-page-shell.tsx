import type { ReactNode } from 'react';
import { AuthPage } from '../auth-page';
import { dictionary, type Locale } from '@/lib/i18n/dictionaries';

export function InvitePageShell({
  backHref,
  backLabel,
  children,
  locale,
  title,
}: {
  readonly backHref: string;
  readonly backLabel: string;
  readonly children: ReactNode;
  readonly locale: Locale;
  readonly title: string;
}) {
  const dict = dictionary(locale);
  return (
    <AuthPage dict={dict} title={title} backHref={backHref} backLabel={backLabel}>
      {children}
    </AuthPage>
  );
}
