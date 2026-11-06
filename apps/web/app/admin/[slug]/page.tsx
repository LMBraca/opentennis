import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { eventCounts } from '../tournament-actions';
import { AdminGrid } from './admin-grid';
import { RegistrationPanel } from './registration-panel';
import { StatusBar } from './status-bar';
import { DangerZone } from './danger-zone';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from './manage.module.css';

export const metadata: Metadata = { title: 'Manage tournament' };
export const dynamic = 'force-dynamic';

export default async function ManagePage({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser(`/admin/${slug}`);
  const organizationId = orgId();

  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      venue: schema.tournaments.venue,
      startDate: schema.tournaments.startDate,
      status: schema.tournaments.status,
      visibility: schema.tournaments.visibility,
      entriesOpen: schema.tournaments.entriesOpen,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);

  const tournament = rows[0];
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

  const totalEntrants = [...counts.values()].reduce((n, c) => n + c.entrants, 0);
  const totalMatches = [...counts.values()].reduce((n, c) => n + c.matches, 0);

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin', label: 'Back to tournaments' }}
        title={tournament.name}
        facts={[
          { value: events.length, label: events.length === 1 ? 'draw' : 'draws' },
          { value: totalEntrants, label: 'entrants' },
          { value: totalMatches, label: totalMatches === 1 ? 'match' : 'matches' },
        ]}
      />

      <PageBody>
        <StatusBar
          slug={slug}
          status={tournament.status}
          visibility={tournament.visibility}
        />

        <RegistrationPanel
          slug={slug}
          entriesOpen={tournament.entriesOpen}
          visibility={tournament.visibility}
        />

        <AdminGrid
          slug={slug}
          categories={categories}
          events={events.map((e) => ({
            ...e,
            entrantCount: counts.get(e.id)?.entrants ?? 0,
            matchCount: counts.get(e.id)?.matches ?? 0,
          }))}
        />

        <nav className={styles.links}>
          <Link className={styles.link} href={`/admin/${slug}/scores`}>Results</Link>
          <Link className={styles.link} href={`/admin/${slug}/qr`}>QR codes</Link>
          <Link className={styles.link} href={`/admin/${slug}/schedule`}>Courts and schedule</Link>
          {tournament.visibility !== 'draft' && (
            <Link className={styles.link} href={`/t/${slug}`}>View public page</Link>
          )}
        </nav>

        <DangerZone slug={slug} name={tournament.name} />
      </PageBody>
    </main>
  );
}
