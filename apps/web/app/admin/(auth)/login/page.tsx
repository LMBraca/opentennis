import type { Metadata } from 'next';
import { AuthPage } from '../auth-page';
import { currentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: dict.signIn };
}

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in? There is nothing to do here.
  if ((await currentUser()) !== null) redirect('/admin');
  const { next } = await searchParams;
  const locale = await currentLocale();
  const dict = dictionary(locale);

  return (
    <AuthPage
      backHref="/"
      backLabel={dict.notFoundHome}
      dict={dict}
      eyebrow={dict.adminEyebrow}
      title={dict.signIn}
    >
      <LoginForm next={next ?? '/admin'} dict={dict} />
    </AuthPage>
  );
}
