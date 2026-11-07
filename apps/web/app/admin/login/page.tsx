import type { Metadata } from 'next';
import { currentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import styles from './login.module.css';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { LanguageToggle } from '@/components/language-toggle';

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
    <main className={styles.page}>
      <LanguageToggle active={locale} />
      <div className={styles.panel}>
        <p className={styles.club}>Open Tennis</p>
        <h1 className={styles.title}>{dict.adminEyebrow}</h1>
        <LoginForm next={next ?? '/admin'} dict={dict} />
      </div>
    </main>
  );
}
