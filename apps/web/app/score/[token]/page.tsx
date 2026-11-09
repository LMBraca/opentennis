/**
 * INF-3 — the courtside page a scorekeeper link opens.
 *
 * The link IS the credential, so this route is public by URL and guarded
 * only by the token being unguessable. Three consequences, all deliberate:
 *
 *   - `noindex`. A link in a WhatsApp group should not end up in a search
 *     result, and this page would otherwise be crawlable by anyone the
 *     volunteer forwards it to.
 *   - A bad or revoked token renders the SAME page as a mistyped one. The
 *     holder of a cancelled link learns nothing from the difference.
 *   - It shows only this tournament's matches, enforced again in the action
 *     (`actorMayScore`) rather than trusted from the page.
 *
 * Reuses the organizer's score list verbatim. A second scoring UI for
 * volunteers would be a second set of validation rules to keep in step with
 * the engine, and the one at the side of a court is the one that must be
 * right.
 */

import type { Metadata } from 'next';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { schema, scorekeeperFromToken } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { resolveScoringFormat } from '@/lib/match-result';
import { UNDOABLE_EVENT_KINDS } from '@/lib/score-history';
import { drawLabel, type Discipline, type Division } from '@/lib/divisions';
import { roundLabel } from '@/lib/draw-text';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';
import { venueTimeFormatter } from '@/lib/venue-time';
import { PageHeader, PageBody } from '@/components/page-header';
import { ScoreList, type MatchRow } from '../../admin/[slug]/scores/score-list';
import adminStyles from '../../admin/admin.module.css';
import styles from './score.module.css';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const dict = dictionary(await currentLocale());
  const grant = await scorekeeperFromToken(db(), token);
  return {
    title:
      grant === null || grant.organizationId !== orgId()
        ? dict.scoreLinkInvalid
        : dict.scoresTitle,
    // A credential in a URL must never be indexed.
    robots: { index: false, follow: false, nocache: true },
  };
}
export const dynamic = 'force-dynamic';

export default async function ScorekeeperPage({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const grant = await scorekeeperFromToken(db(), token);

  // Same response for wrong, revoked and expired.
  if (grant === null || grant.organizationId !== orgId()) {
    return (
      <main className={adminStyles.page}>
        <PageHeader variant="tool" title={dict.scoreLinkInvalid} />
        <PageBody>
          <p className={styles.dead}>{dict.scoreLinkInvalidBody}</p>
        </PageBody>
      </main>
    );
  }

  const [tournament] = await db()
    .select({ name: schema.tournaments.name })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.id, grant.tournamentId))
    .limit(1);

  const rows = await db()
    .select({
      id: schema.matches.id,
      status: schema.matches.status,
      outcome: schema.matches.outcome,
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
    .where(eq(schema.matches.tournamentId, grant.tournamentId))
    .orderBy(asc(schema.rounds.roundIndex), asc(schema.matches.slotIndex));

  const sides = await db()
    .select({
      matchId: schema.matchSides.matchId,
      position: schema.matchSides.position,
      entrantId: schema.matchSides.entrantId,
      sourceKind: schema.matchSides.sourceKind,
    })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(eq(schema.matches.tournamentId, grant.tournamentId))
    .orderBy(asc(schema.matchSides.position));

  const playerRows = await db()
    .select({ entrantId: schema.entrantPlayers.entrantId, lastName: schema.players.lastName })
    .from(schema.entrantPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .where(eq(schema.events.tournamentId, grant.tournamentId))
    .orderBy(asc(schema.entrantPlayers.position));

  const nameBy = new Map<string, string>();
  for (const r of playerRows) {
    const existing = nameBy.get(r.entrantId);
    nameBy.set(r.entrantId, existing === undefined ? r.lastName : `${existing} / ${r.lastName}`);
  }

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
    .where(eq(schema.matches.tournamentId, grant.tournamentId))
    .orderBy(asc(schema.sets.setIndex));

  const undoable = await db()
    .select({ matchId: schema.scoreEvents.matchId })
    .from(schema.scoreEvents)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.scoreEvents.matchId))
    .where(
      and(
        eq(schema.matches.tournamentId, grant.tournamentId),
        eq(schema.matches.status, 'complete'),
        isNull(schema.scoreEvents.revertedByEventId),
        inArray(schema.scoreEvents.kind, [...UNDOABLE_EVENT_KINDS]),
      ),
    );
  const canUndoBy = new Set(undoable.map((r) => r.matchId));

  const sidesBy = new Map<string, typeof sides>();
  for (const s of sides) sidesBy.set(s.matchId, [...(sidesBy.get(s.matchId) ?? []), s]);
  const setsBy = new Map<string, typeof setRows>();
  for (const s of setRows) setsBy.set(s.matchId, [...(setsBy.get(s.matchId) ?? []), s]);

  const timeFormatter = venueTimeFormatter(locale);

  const matches: MatchRow[] = rows
    .filter((r) => r.status !== 'bye')
    .map((r) => {
      const mySides = sidesBy.get(r.id) ?? [];
      return {
        id: r.id,
        status: r.status,
        outcome: r.outcome,
        roundName: r.roundName === null ? '' : roundLabel(r.roundName, dict),
        courtName:
          r.courtName === null
            ? r.scheduledAt === null
              ? null
              : timeFormatter.format(r.scheduledAt)
            : `${r.courtName}${r.scheduledAt === null ? '' : ` ${timeFormatter.format(r.scheduledAt)}`}`,
        drawLabel: drawLabel(
          r.categoryCode,
          r.division as Division,
          r.discipline as Discipline,
          dict,
        ),
        format: resolveScoringFormat(r, r.scoringOverride),
        canUndo: canUndoBy.has(r.id),
        sides: [0, 1].map((position) => {
          const side = mySides.find((s) => s.position === position);
          return {
            position,
            name: side?.entrantId == null ? null : (nameBy.get(side.entrantId) ?? null),
            isWinner: false,
            isBye: side?.sourceKind === 'bye',
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

  // Same grouping as the organizer's page, so a volunteer and an organizer
  // looking at the same tournament see the same three lists.
  const nonBye = matches.filter((m) => !m.sides.some((s) => s.isBye));
  const playable = nonBye.filter(
    (m) => m.status !== 'complete' && m.sides.every((s) => s.name !== null),
  );
  const waiting = nonBye.filter(
    (m) => m.status !== 'complete' && m.sides.some((s) => s.name === null),
  );
  const done = nonBye.filter((m) => m.status === 'complete');

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        title={tournament?.name ?? dict.scoresTitle}
        lead={fill(dict.scoringAs, { label: grant.label })}
        facts={[
          { value: playable.length, label: dict.readyToScore, emphasis: playable.length > 0 },
          { value: done.length, label: dict.recorded },
        ]}
      />
      <PageBody>
        <ScoreList
          playable={playable}
          waiting={waiting}
          done={done}
          scorekeeperToken={token}
          dict={dict}
        />
      </PageBody>
    </main>
  );
}
