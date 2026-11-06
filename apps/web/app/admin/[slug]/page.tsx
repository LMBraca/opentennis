/**
 * Running one tournament.
 *
 * Rebuilt around the PHASE (lib/tournament-phase.ts) after the old version
 * proved unusable: two independent status axes with eight buttons, a
 * registration panel asserting "entries are open" directly above a draws
 * panel asking you to close them, a twelve-cell matrix to express one
 * draw, and eight flat links of which several opened a blank page until
 * some earlier step was done.
 *
 * The shape now is: where you are, the one thing to do next, the draws,
 * then everything else folded away. Tools appear only once they would show
 * something — an order of play before anything is scheduled is a blank
 * sheet, and a blank sheet reads as a broken page.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { and, asc, count, eq, isNotNull } from 'drizzle-orm';
import { can, schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { eventCounts } from '../tournament-actions';
import {
  nextAction,
  phaseLabel,
  PHASE_ORDER,
  toolAvailable,
  type PhaseInput,
} from '@/lib/tournament-phase';
import { AdminGrid } from './admin-grid';
import { PhasePanel } from './phase-panel';
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
  const user = await requireUser(`/admin/${slug}`);
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
  const drawnCount = [...counts.values()].filter((c) => c.matches > 0).length;

  const [decided] = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.tournamentId, tournament.id),
        isNotNull(schema.matches.winnerEntrantId),
      ),
    );

  const phaseInput: PhaseInput = {
    status: tournament.status,
    entriesOpen: tournament.entriesOpen,
    eventCount: events.length,
    drawnCount,
    decidedCount: decided?.n ?? 0,
    matchCount: totalMatches,
  };
  const view = nextAction(phaseInput);

  /*
   * The entry link is built from the request, like the QR codes: one
   * copied on localhost and sent to a player points at their own phone.
   */
  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const entryUrl = `${proto}://${host}/t/${slug}/enter`;

  const reached = PHASE_ORDER.indexOf(view.phase);
  const steps = PHASE_ORDER.map((p, index) => ({
    key: p,
    label: phaseLabel(p),
    done: reached > index,
  }));

  const TOOLS = [
    { key: 'entries', href: `/admin/${slug}/entries`, label: 'Entries' },
    { key: 'scores', href: `/admin/${slug}/scores`, label: 'Results' },
    { key: 'qr', href: `/admin/${slug}/qr`, label: 'QR codes' },
    { key: 'sheets', href: `/admin/${slug}/print`, label: 'Draw sheets' },
    { key: 'schedule', href: `/admin/${slug}/schedule`, label: 'Courts and schedule' },
    { key: 'order', href: `/admin/${slug}/order`, label: 'Order of play' },
    { key: 'scorekeepers', href: `/admin/${slug}/scorekeepers`, label: 'Scorekeepers' },
    { key: 'export', href: `/admin/${slug}/export`, label: 'Export results' },
  ] as const;

  const tools = TOOLS.filter((tool) => toolAvailable(tool.key, phaseInput));

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin', label: 'Back to tournaments' }}
        title={tournament.name}
        facts={[
          { value: events.length, label: events.length === 1 ? 'draw' : 'draws' },
          { value: totalEntrants, label: totalEntrants === 1 ? 'entrant' : 'entrants' },
          { value: totalMatches, label: totalMatches === 1 ? 'match' : 'matches' },
        ]}
      />

      <PageBody>
        <PhasePanel
          slug={slug}
          phase={view.phase}
          label={view.label}
          next={view.next}
          detail={view.detail}
          steps={steps}
          entryUrl={tournament.entriesOpen ? entryUrl : null}
          entrantCount={totalEntrants}
          canAct={can(user.role, 'tournaments:manage')}
        />

        <AdminGrid
          slug={slug}
          entriesOpen={tournament.entriesOpen}
          canManageDraws={can(user.role, 'draws:manage')}
          categories={categories}
          events={events.map((e) => ({
            ...e,
            entrantCount: counts.get(e.id)?.entrants ?? 0,
            matchCount: counts.get(e.id)?.matches ?? 0,
          }))}
        />

        {tools.length > 0 && (
          <nav className={styles.links}>
            {tools.map((tool) => (
              <Link key={tool.key} className={styles.link} href={tool.href}>
                {tool.label}
              </Link>
            ))}
            {tournament.visibility !== 'draft' && (
              <Link className={styles.link} href={`/t/${slug}`}>
                View public page
              </Link>
            )}
          </nav>
        )}

        {/*
          The two status axes are still here, because a club genuinely does
          sometimes need to cancel, unpublish or reopen out of sequence —
          but folded, because needing them is the exception and having them
          open is what made the page unreadable.
        */}
        {can(user.role, 'tournaments:manage') && (
          <details className={styles.fold}>
            <summary className={styles.foldSummary}>Status and visibility</summary>
            <div className={styles.foldBody}>
              <StatusBar slug={slug} status={tournament.status} visibility={tournament.visibility} />
            </div>
          </details>
        )}

        {can(user.role, 'destructive') && (
          <details className={styles.fold}>
            <summary className={styles.foldSummary}>Danger zone</summary>
            <div className={styles.foldBody}>
              <DangerZone slug={slug} name={tournament.name} />
            </div>
          </details>
        )}
      </PageBody>
    </main>
  );
}
