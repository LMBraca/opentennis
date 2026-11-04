import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { createUpdateAction } from '../update-actions';
import { UpdateForm } from '../update-form';
import styles from '../../admin.module.css';

export const metadata: Metadata = { title: 'New update · Admin' };
export const dynamic = 'force-dynamic';

export default async function NewUpdate() {
  await requireUser('/admin/updates/new');

  const tournaments = await db()
    .select({ id: schema.tournaments.id, name: schema.tournaments.name })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.organizationId, orgId()))
    .orderBy(asc(schema.tournaments.startDate));

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.club}>Open Tennis · Admin</p>
          <h1 className={styles.title}>New update</h1>
        </div>
      </header>
      <div className={styles.content}>
        <UpdateForm
          action={createUpdateAction}
          tournaments={tournaments}
          submitLabel="Save update"
          initial={{
            title: '',
            excerpt: '',
            body: '',
            coverUrl: '',
            coverAlt: '',
            tournamentId: '',
            media: '',
            published: false,
          }}
        />
      </div>
    </main>
  );
}
