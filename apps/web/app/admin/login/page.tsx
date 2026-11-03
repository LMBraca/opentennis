import type { Metadata } from 'next';
import { currentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import styles from './login.module.css';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in? There is nothing to do here.
  if ((await currentUser()) !== null) redirect('/admin');
  const { next } = await searchParams;

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <p className={styles.club}>Open Tennis</p>
        <h1 className={styles.title}>Admin</h1>
        <LoginForm next={next ?? '/admin'} />
      </div>
    </main>
  );
}
