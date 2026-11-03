import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { eventCounts } from '../tournament-actions';
import { AdminGrid } from './admin-grid';
import { EntrantList } from './entrant-list';
import { RegistrationPanel } from './registration-panel';
import { StatusBar } from './status-bar';
import { DangerZone } from './danger-zone';
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
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <Link href="/admin" className={styles.back}>← Admin</Link>
          <h1 className={styles.title}>{tournament.name}</h1>
          <p className={styles.sub}>
            {[tournament.venue, tournament.startDate].filter(Boolean).join(' · ')} · /t/{slug}
          </p>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{events.length}</span>
              <span className={styles.statLabel}>Draws</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{totalEntrants}</span>
              <span className={styles.statLabel}>Entrants</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{totalMatches}</span>
              <span className={styles.statLabel}>Matches</span>
            </span>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <StatusBar
          slug={slug}
          status={tournament.status}
          visibility={tournament.visibility}
        />

        <RegistrationPanel slug={slug} entriesOpen={tournament.entriesOpen} />

        <AdminGrid
          slug={slug}
          categories={categories}
          events={events.map((e) => ({
            ...e,
            entrantCount: counts.get(e.id)?.entrants ?? 0,
            matchCount: counts.get(e.id)?.matches ?? 0,
          }))}
          entrantLists={Object.fromEntries(
            events.map((e) => [e.id, <EntrantList key={e.id} slug={slug} eventId={e.id} />]),
          )}
        />

        <nav className={styles.links}>
          <Link className={styles.link} href={`/admin/${slug}/schedule`}>Courts &amp; schedule →</Link>
          <Link className={styles.link} href={`/t/${slug}`}>View public page →</Link>
        </nav>

        <DangerZone slug={slug} name={tournament.name} />
      </div>
    </main>
  );
}
