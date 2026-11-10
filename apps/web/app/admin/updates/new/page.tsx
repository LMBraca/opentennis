import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { createUpdateAction } from '../update-actions';
import { UpdateForm } from '../update-form';
import { PageHeader, PageBody } from '@/components/page-header';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: `${dict.newUpdateTitle} · ${dict.adminEyebrow}` };
}

export default async function NewUpdate() {
  await requireUser('/admin/updates/new');
  const dict = dictionary(await currentLocale());

  const tournaments = await db()
    .select({ id: schema.tournaments.id, name: schema.tournaments.name })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.organizationId, orgId()))
    .orderBy(asc(schema.tournaments.startDate));

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin/updates', label: dict.backToUpdates }}
        title={dict.newUpdateTitle}
      />
      <PageBody>
        <UpdateForm
          action={createUpdateAction}
          tournaments={tournaments}
          submitLabel={dict.saveUpdate}
          dict={dict}
          initial={{
            title: '',
            excerpt: '',
            body: '',
            bodyHtml: '',
            coverUrl: '',
            coverAlt: '',
            tournamentId: '',
            media: '',
            published: false,
          }}
        />
      </PageBody>
    </main>
  );
}
