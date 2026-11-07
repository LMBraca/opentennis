import type { Metadata } from 'next';
import { requireCapability } from '@/lib/auth';
import { NewTournamentForm } from './form';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from '../[slug]/schedule/schedule.module.css';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: dict.newTournament };
}

export default async function NewTournamentPage() {
  await requireCapability('tournaments:manage', '/admin/new');
  const dict = dictionary(await currentLocale());
  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin', label: dict.backToTournaments }}
        title={dict.newTournament}
      />
      <PageBody>
        <NewTournamentForm dict={dict} />
      </PageBody>
    </main>
  );
}
