/**
 * RV-17, step 1 — which draws this tournament runs.
 *
 * The same `AdminGrid` the tournament page uses, not a second grid built
 * for the wizard. A wizard that renders its own version of a control the
 * product already has is how two screens drift apart, and this repo has
 * been bitten by exactly that twice (twelve mastheads, then the footer).
 * The wizard is a PATH through existing screens, not a parallel product.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { can, schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { eventCounts } from '../../../tournament-actions';
import { AdminGrid } from '../../admin-grid';
import { SetupSteps, SetupNext } from '@/components/setup-steps';
import { PageHeader, PageBody } from '@/components/page-header';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import styles from '../../manage.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: { absolute: `${dict.setupDraws} · ${dict.adminEyebrow}` } };
}

export default async function SetupDrawsPage({ params }: Params) {
  const { slug } = await params;
  const user = await requireUser(`/admin/${slug}/setup/draws`);
  const organizationId = orgId();
  const dict = dictionary(await currentLocale());

  const [tournament] = await db()
    .select({ id: schema.tournaments.id, name: schema.tournaments.name, entriesOpen: schema.tournaments.entriesOpen })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.slug, slug))
    .limit(1);
  if (tournament === undefined) notFound();

  const categories = await db()
    .select({
      id: schema.categories.id,
      code: schema.categories.code,
      slug: schema.categories.slug,
      rank: schema.categories.rank,
    })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, organizationId))
    .orderBy(asc(schema.categories.rank));

  const events = await db()
    .select({
      id: schema.events.id,
      categoryId: schema.events.categoryId,
      discipline: schema.events.discipline,
      division: schema.events.division,
      format: schema.events.format,
      status: schema.events.status,
    })
    .from(schema.events)
    .where(eq(schema.events.tournamentId, tournament.id));

  const counts = await eventCounts(tournament.id);

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title={dict.setupDraws}
        lead={dict.setupDrawsLead}
      />
      <PageBody>
        <SetupSteps slug={slug} active="draws" dict={dict} />
        <AdminGrid
          slug={slug}
          entriesOpen={tournament.entriesOpen}
          canManageDraws={can(user.role, 'draws:manage')}
          setup
          categories={categories}
          events={events.map((e) => ({
            ...e,
            entrantCount: counts.get(e.id)?.entrants ?? 0,
            matchCount: counts.get(e.id)?.matches ?? 0,
            resultCount: counts.get(e.id)?.results ?? 0,
          }))}
          dict={dict}
        />
        <SetupNext slug={slug} active="draws" dict={dict} />
      </PageBody>
    </main>
  );
}
