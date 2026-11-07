/**
 * Results.
 *
 * A list of matches, not a bracket. An organizer entering scores is working
 * through an order of play — "court 2 just finished" — not navigating a
 * tree. Playable matches come first because those are the ones about to
 * need a score; finished ones stay visible below so a mistake can be
 * corrected without hunting.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@opentennis/db';
import { PageHeader, PageBody } from '@/components/page-header';
import { drawLabel, type Discipline, type Division } from '@/lib/divisions';
import { dictionary } from '@/lib/i18n/dictionaries';
import { currentLocale } from '@/lib/i18n/server';
import { resolveScoringFormat } from '@/lib/match-result';
import { ScoreList, type MatchRow } from './score-list';
import styles from '../../admin.module.css';

export const metadata: Metadata = { title: 'Results · Admin' };
export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export default async function ScoresPage({ params }: Params) {
  const { slug } = await params;
  const user = await requireUser(`/admin/${slug}/scores`);
  const dict = dictionary(await currentLocale());

  const tournaments = await db()
    .select({ id: schema.tournaments.id, name: schema.tournaments.name })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)))
    .limit(1);
  const tournament = tournaments[0];
  if (tournament === undefined) notFound();

  const rows = await db()
    .select({
      id: schema.matches.id,
      status: schema.matches.status,
      outcome: schema.matches.outcome,
      winnerEntrantId: schema.matches.winnerEntrantId,
      scheduledAt: schema.matches.scheduledAt,
      roundName: schema.rounds.name,
      roundIndex: schema.rounds.roundIndex,
      courtName: schema.courts.name,
      categoryCode: schema.categories.code,
      discipline: schema.events.discipline,
      division: schema.events.division,
      setsToWin: schema.events.setsToWin,
      gamesPerSet: schema.events.gamesPerSet,
      tiebreakAt: schema.events.tiebreakAt,
      tiebreakTo: schema.events.tiebreakTo,
      decidingSetMode: schema.events.decidingSetMode,
      adScoring: schema.events.adScoring,
      scoringOverride: schema.rounds.scoringOverride,
    })
    .from(schema.matches)
    .innerJoin(schema.events, eq(schema.events.id, schema.matches.eventId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .leftJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .leftJoin(schema.courts, eq(schema.courts.id, schema.matches.courtId))
    .where(eq(schema.matches.tournamentId, tournament.id))
    .orderBy(asc(schema.rounds.roundIndex), asc(schema.matches.slotIndex));

  const sides = await db()
    .select({
      matchId: schema.matchSides.matchId,
      position: schema.matchSides.position,
      entrantId: schema.matchSides.entrantId,
    })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(eq(schema.matches.tournamentId, tournament.id))
    .orderBy(asc(schema.matchSides.position));

  /*
   * An entrant has no name of its own: it is one player in singles and two
   * in doubles, joined through entrantPlayers. Surnames only, which is what
   * a draw sheet shows and what fits a phone.
   */
  const playerRows = await db()
    .select({
      entrantId: schema.entrantPlayers.entrantId,
      lastName: schema.players.lastName,
    })
    .from(schema.entrantPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .where(eq(schema.events.tournamentId, tournament.id))
    .orderBy(asc(schema.entrantPlayers.position));

  const nameBy = new Map<string, string>();
  for (const r of playerRows) {
    const existing = nameBy.get(r.entrantId);
    nameBy.set(r.entrantId, existing === undefined ? r.lastName : `${existing} / ${r.lastName}`);
  }

  /*
   * SCR-5: which matches have something to step back to. One grouped query
   * rather than a log read per row — a tournament has hundreds of matches.
   */
  const undoable = await db()
    .select({ matchId: schema.scoreEvents.matchId })
    .from(schema.scoreEvents)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.scoreEvents.matchId))
    .where(
      and(
        eq(schema.matches.tournamentId, tournament.id),
        isNull(schema.scoreEvents.revertedByEventId),
      ),
    );
  const canUndoBy = new Set(undoable.map((r) => r.matchId));

  const setRows = await db()
    .select({
      matchId: schema.sets.matchId,
      setIndex: schema.sets.setIndex,
      side0Games: schema.sets.side0Games,
      side1Games: schema.sets.side1Games,
      side0TiebreakPoints: schema.sets.side0TiebreakPoints,
      side1TiebreakPoints: schema.sets.side1TiebreakPoints,
    })
    .from(schema.sets)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.sets.matchId))
    .where(eq(schema.matches.tournamentId, tournament.id))
    .orderBy(asc(schema.sets.setIndex));

  const sidesBy = new Map<string, typeof sides>();
  for (const s of sides) {
    const list = sidesBy.get(s.matchId) ?? [];
    list.push(s);
    sidesBy.set(s.matchId, list);
  }
  const setsBy = new Map<string, typeof setRows>();
  for (const s of setRows) {
    const list = setsBy.get(s.matchId) ?? [];
    list.push(s);
    setsBy.set(s.matchId, list);
  }

  const matches: MatchRow[] = rows.map((r) => {
    const mySides = sidesBy.get(r.id) ?? [];
    return {
      id: r.id,
      status: r.status,
      outcome: r.outcome,
      roundName: r.roundName ?? '',
      courtName: r.courtName,
      drawLabel: drawLabel(
        r.categoryCode,
        r.division as Division,
        r.discipline as Discipline,
        dict,
      ),
      // Round override wins, so the form shows the right number of set
      // rows for a final played under different rules.
      format: resolveScoringFormat(r, r.scoringOverride),
      canUndo: canUndoBy.has(r.id),
      sides: [0, 1].map((position) => {
        const side = mySides.find((s) => s.position === position);
        return {
          position,
          // A slot fed by an unplayed match has no entrant yet; the list uses
          // this to tell "waiting on a result" from "ready to play".
          name: side?.entrantId == null ? null : (nameBy.get(side.entrantId) ?? null),
          isWinner: side?.entrantId != null && side.entrantId === r.winnerEntrantId,
        };
      }),
      sets: (setsBy.get(r.id) ?? []).map((s) => ({
        setIndex: s.setIndex,
        side0Games: s.side0Games,
        side1Games: s.side1Games,
        side0TiebreakPoints: s.side0TiebreakPoints,
        side1TiebreakPoints: s.side1TiebreakPoints,
      })),
    };
  });

  const playable = matches.filter(
    (m) => m.status !== 'complete' && m.status !== 'bye' && m.sides.every((s) => s.name !== null),
  );
  const waiting = matches.filter(
    (m) => m.status !== 'complete' && m.status !== 'bye' && m.sides.some((s) => s.name === null),
  );
  const done = matches.filter((m) => m.status === 'complete');

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title="Results"
        facts={[
          { value: playable.length, label: 'ready to score', emphasis: playable.length > 0 },
          { value: done.length, label: 'recorded' },
          { value: waiting.length, label: 'waiting on a result' },
        ]}
      />
      <PageBody>
        <ScoreList
          playable={playable}
          waiting={waiting}
          done={done}
          canScore={can(user.role, 'scores:write')}
          dict={dict}
        />
      </PageBody>
    </main>
  );
}
