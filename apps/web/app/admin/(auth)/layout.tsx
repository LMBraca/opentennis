import type { ReactNode } from 'react';
import { AuthShell } from './auth-shell';
import { dictionary } from '@/lib/i18n/dictionaries';
import { currentLocale } from '@/lib/i18n/server';

export default async function AuthLayout({ children }: { readonly children: ReactNode }) {
  const locale = await currentLocale();
  return (
    <AuthShell locale={locale} dict={dictionary(locale)}>
      {children}
    </AuthShell>
  );
}
