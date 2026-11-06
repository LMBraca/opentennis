import type { Metadata } from 'next';
import { requireCapability } from '@/lib/auth';
import { NewTournamentForm } from './form';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from '../[slug]/schedule/schedule.module.css';

export const metadata: Metadata = { title: 'New tournament' };
export const dynamic = 'force-dynamic';

export default async function NewTournamentPage() {
  await requireCapability('tournaments:manage', '/admin/new');
  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin', label: 'Back to tournaments' }}
        title="New tournament"
      />
      <PageBody>
        <NewTournamentForm />
      </PageBody>
    </main>
  );
}
