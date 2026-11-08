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
  PHASE_ORDER,
  toolAvailable,
  type PhaseInput,
} from '@/lib/tournament-phase';
import { AdminGrid } from './admin-grid';
import { PhasePanel } from './phase-panel';
import { StatusBar } from './status-bar';
import { DangerZone } from './danger-zone';
import { PageHeader, PageBody } from '@/components/page-header';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';
import styles from './manage.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: dict.manageTournamentTitle };
}

export default async function ManagePage({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser(`/admin/${slug}`);
  const dict = dictionary(await currentLocale());
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

  /*
   * A category marked "not held" is off the books.
   *
   * It used to count in the denominator, so an organizer who did the right
   * thing with an empty category — marked it not held rather than deleting
   * it — was told "3 of 4 done" for the rest of the tournament, with
   * nothing left that could make it say 4. `generateDraws` already skips
   * these; the progress count simply disagreed with it.
   */
  const running = events.filter((e) => e.status !== 'notRun');
  const runningIds = new Set(running.map((e) => e.id));
  const drawnCount = [...counts.entries()].filter(
    ([id, c]) => runningIds.has(id) && c.matches > 0,
  ).length;

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
    eventCount: running.length,
    drawnCount,
    decidedCount: decided?.n ?? 0,
    matchCount: totalMatches,
  };

  /*
   * The entry link is built from the request, like the QR codes: one
   * copied on localhost and sent to a player points at their own phone.
   */
  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const entryUrl = `${proto}://${host}/t/${slug}/enter`;

  const phaseView = nextAction(phaseInput);
  const reached = PHASE_ORDER.indexOf(phaseView.phase);
  const phaseLabels = {
    setup: dict.phaseSetup,
    entries: dict.phaseEntries,
    draws: dict.phaseDraws,
    play: dict.phasePlay,
    done: dict.phaseDone,
    cancelled: dict.phaseCancelled,
  } as const;
  const steps = PHASE_ORDER.map((p, index) => ({
    key: p,
    label: phaseLabels[p],
    done: reached > index,
  }));

  const view =
    phaseView.phase === 'setup'
      ? phaseInput.eventCount === 0
        ? {
            ...phaseView,
            label: phaseLabels.setup,
            next: dict.manageChooseCategories,
            detail: dict.manageChooseCategoriesDetail,
          }
        : {
            ...phaseView,
            label: phaseLabels.setup,
            next: dict.openEntries,
            detail: dict.playersCanEnter,
          }
      : phaseView.phase === 'entries'
        ? {
            ...phaseView,
            label: phaseLabels.entries,
            next: dict.closeEntries,
            detail:
              phaseInput.eventCount === 0
                ? dict.noCategoriesChosen
                : dict.drawsReadyAfterFieldSettled,
          }
        : phaseView.phase === 'draws'
          ? {
              ...phaseView,
              label: phaseLabels.draws,
              next: dict.generateDraws,
              detail:
                phaseInput.drawnCount === 0
                  ? dict.fieldSettled
                  : fill(dict.drawProgress, {
                      drawn: String(phaseInput.drawnCount),
                      total: String(phaseInput.eventCount),
                    }),
            }
          : phaseView.phase === 'play'
            ? phaseInput.decidedCount < phaseInput.matchCount
              ? {
                  ...phaseView,
                  label: phaseLabels.play,
                  next: dict.recordResults,
                  detail: fill(dict.matchesPlayed, {
                    played: String(phaseInput.decidedCount),
                    total: String(phaseInput.matchCount),
                  }),
                }
              : {
                  ...phaseView,
                  label: phaseLabels.play,
                  next: dict.markTournamentComplete,
                  detail: dict.everyMatchHasResult,
                }
            : phaseView.phase === 'done'
              ? {
                  ...phaseView,
                  label: dict.phaseDone,
                  detail: dict.finishedDrawsStayPublished,
                }
              : {
                  ...phaseView,
                  label: dict.phaseCancelled,
                  detail: dict.tournamentCancelled,
                };

  const toolsList = [
    { key: 'entries', href: `/admin/${slug}/entries`, label: dict.entriesTitle },
    { key: 'scores', href: `/admin/${slug}/scores`, label: dict.scoresTitle },
    { key: 'qr', href: `/admin/${slug}/qr`, label: dict.qrCodesTitle },
    { key: 'sheets', href: `/admin/${slug}/print`, label: dict.drawSheetsTitle },
    { key: 'schedule', href: `/admin/${slug}/schedule`, label: dict.scheduleTitle },
    { key: 'order', href: `/admin/${slug}/order`, label: dict.orderOfPlay },
    { key: 'scorekeepers', href: `/admin/${slug}/scorekeepers`, label: dict.scorekeepersTitle },
    { key: 'export', href: `/admin/${slug}/export`, label: dict.exportResults },
  ] as const;

  const tools = toolsList.filter((tool) => toolAvailable(tool.key, phaseInput));

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: '/admin', label: dict.backToTournaments }}
        title={tournament.name}
        facts={[
          { value: events.length, label: events.length === 1 ? dict.draw : dict.draws },
          { value: totalEntrants, label: totalEntrants === 1 ? dict.entrant : dict.entrants },
          { value: totalMatches, label: totalMatches === 1 ? dict.match : dict.matches },
        ]}
      />

      <PageBody>
        <PhasePanel
          slug={slug}
          phase={view.phase}
          label={view.label}
          next={view.next}
          detail={view.detail}
          actionable={view.actionable}
          link={view.link}
          steps={steps}
          entryUrl={tournament.entriesOpen ? entryUrl : null}
          /* OT-11: open for entries but not listed anywhere public. */
          notPublic={tournament.entriesOpen && tournament.visibility !== 'public'}
          entrantCount={totalEntrants}
          canAct={can(user.role, 'tournaments:manage')}
          dict={dict}
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
          dict={dict}
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
                {dict.viewPublicPage}
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
            <summary className={styles.foldSummary}>{dict.statusAndVisibility}</summary>
            <div className={styles.foldBody}>
              <StatusBar
                slug={slug}
                status={tournament.status}
                visibility={tournament.visibility}
                dict={dict}
              />
            </div>
          </details>
        )}

        {can(user.role, 'destructive') && (
          <details className={styles.fold}>
            <summary className={styles.foldSummary}>{dict.dangerZone}</summary>
            <div className={styles.foldBody}>
              <DangerZone slug={slug} name={tournament.name} />
            </div>
          </details>
        )}
      </PageBody>
    </main>
  );
}
