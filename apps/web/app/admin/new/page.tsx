import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { NewTournamentForm } from './form';
import styles from '../[slug]/schedule/schedule.module.css';

export const metadata: Metadata = { title: 'New tournament' };
export const dynamic = 'force-dynamic';

export default async function NewTournamentPage() {
  await requireUser('/admin/new');
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <Link href="/admin" className={styles.back}>← Admin</Link>
          <h1 className={styles.title}>New tournament</h1>
          <p className={styles.sub}>It starts as a draft. Nothing is public until you publish it.</p>
        </div>
      </header>
      <div className={styles.content}>
        <NewTournamentForm />
      </div>
    </main>
  );
}
