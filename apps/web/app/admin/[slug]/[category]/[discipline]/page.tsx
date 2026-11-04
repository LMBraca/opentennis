import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { drawLabel, parseDrawSegment } from '@/lib/divisions';
import { stripeEnabled } from '@/lib/stripe';
import { listEntrants } from '../../../tournament-actions';
import { EntrantsTable } from './entrants-table';
import { AddEntrants } from './add-entrants';
import { FeePanel } from './fee-panel';
import styles from './entrants.module.css';

export const metadata: Metadata = { title: 'Entrants' };
export const dynamic = 'force-dynamic';

const EN = {
  divisionOpen: 'Open',
  divisionMens: "Men's",
  divisionWomens: "Women's",
  singles: 'Singles',
  doubles: 'Doubles',
};

export default async function EntrantsPage({
  params,
}: {
  readonly params: Promise<{ slug: string; category: string; discipline: string }>;
}) {
  const { slug, category, discipline } = await params;
  await requireUser(`/admin/${slug}/${category}/${discipline}`);
  const organizationId = orgId();

  const parsed = parseDrawSegment(discipline);
  if (parsed === null) notFound();

  const rows = await db()
    .select({
      eventId: schema.events.id,
      format: schema.events.format,
      status: schema.events.status,
      entryFeeCents: schema.events.entryFeeCents,
      currency: schema.events.currency,
      tournamentName: schema.tournaments.name,
      categoryCode: schema.categories.code,
    })
    .from(schema.events)
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(
      and(
        eq(schema.events.organizationId, organizationId),
        eq(schema.tournaments.slug, slug),
        eq(schema.categories.slug, category),
        eq(schema.events.discipline, parsed.discipline),
        eq(schema.events.division, parsed.division),
      ),
    )
    .limit(1);

  const event = rows[0];
  if (event === undefined) notFound();

  const entrants = await listEntrants(event.eventId);
  const label = drawLabel(event.categoryCode, parsed.division, parsed.discipline, EN);

  const seeded = entrants.filter((e) => e.seed !== null).length;
  const unpaid = entrants.filter((e) => e.payment === 'unpaid').length;
  const pending = entrants.filter((e) => e.payment === 'pending').length;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <Link href={`/admin/${slug}`} className={styles.back}>
            ← {event.tournamentName}
          </Link>
          <h1 className={styles.title}>{label}</h1>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{entrants.length}</span>
              <span className={styles.statLabel}>Entrants</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statNumber}>{seeded}</span>
              <span className={styles.statLabel}>Seeded</span>
            </span>
            <span className={styles.stat} data-warn={unpaid > 0}>
              <span className={styles.statNumber}>{unpaid}</span>
              <span className={styles.statLabel}>Unpaid</span>
            </span>
            {pending > 0 && (
              <span className={styles.stat}>
                <span className={styles.statNumber}>{pending}</span>
                <span className={styles.statLabel}>Awaiting</span>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <FeePanel
          slug={slug}
          eventId={event.eventId}
          feeCents={event.entryFeeCents}
          currency={event.currency}
          stripeReady={stripeEnabled()}
        />
        <EntrantsTable
          slug={slug}
          eventId={event.eventId}
          entrants={entrants}
          isDoubles={parsed.discipline === 'doubles'}
        />
        <AddEntrants slug={slug} eventId={event.eventId} isDoubles={parsed.discipline === 'doubles'} />
      </div>
    </main>
  );
}
