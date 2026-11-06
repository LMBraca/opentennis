/**
 * OUT-3 — results export.
 *
 * One CSV of every match in a tournament: draw, round, both sides, the sets,
 * the winner and how it ended. The point is that a season's results can
 * leave the product — for the club's own records, a federation return, or
 * a spreadsheet nobody asked me about.
 *
 * A route handler rather than a page: the browser should download a file,
 * not render one.
 */

import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { outcomeAbbreviation } from '@/lib/match-result';
import { drawLabel, type Discipline, type Division } from '@/lib/divisions';
import { dictionary } from '@/lib/i18n/dictionaries';
import { venueDateFormatter, venueTimeFormatter } from '@/lib/venue-time';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  await requireUser(`/admin/${slug}`);
  const organizationId = orgId();

  const [tournament] = await db()
    .select({ id: schema.tournaments.id, name: schema.tournaments.name })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)))
    .limit(1);

  if (tournament === undefined) return new Response('Not found', { status: 404 });

  const rows = await db()
    .select({
      id: schema.matches.id,
      status: schema.matches.status,
      outcome: schema.matches.outcome,
      winnerEntrantId: schema.matches.winnerEntrantId,
      scheduledAt: schema.matches.scheduledAt,
      courtName: schema.courts.name,
      roundName: schema.rounds.name,
      roundIndex: schema.rounds.roundIndex,
      slotIndex: schema.matches.slotIndex,
      categoryCode: schema.categories.code,
      categoryRank: schema.categories.rank,
      discipline: schema.events.discipline,
      division: schema.events.division,
    })
    .from(schema.matches)
    .innerJoin(schema.events, eq(schema.events.id, schema.matches.eventId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .leftJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .leftJoin(schema.courts, eq(schema.courts.id, schema.matches.courtId))
    .where(eq(schema.matches.tournamentId, tournament.id))
    .orderBy(asc(schema.categories.rank), asc(schema.rounds.roundIndex), asc(schema.matches.slotIndex));

  const sides = await db()
    .select({
      matchId: schema.matchSides.matchId,
      position: schema.matchSides.position,
      entrantId: schema.matchSides.entrantId,
    })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(eq(schema.matches.tournamentId, tournament.id));

  const playerRows = await db()
    .select({ entrantId: schema.entrantPlayers.entrantId, lastName: schema.players.lastName, firstName: schema.players.firstName })
    .from(schema.entrantPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .where(eq(schema.events.tournamentId, tournament.id))
    .orderBy(asc(schema.entrantPlayers.position));

  const nameBy = new Map<string, string>();
  for (const r of playerRows) {
    const full = `${r.firstName} ${r.lastName}`.trim();
    const existing = nameBy.get(r.entrantId);
    nameBy.set(r.entrantId, existing === undefined ? full : `${existing} / ${full}`);
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
    .where(eq(schema.matches.tournamentId, tournament.id))
    .orderBy(asc(schema.sets.setIndex));

  const sidesBy = new Map<string, typeof sides>();
  for (const s of sides) sidesBy.set(s.matchId, [...(sidesBy.get(s.matchId) ?? []), s]);
  const setsBy = new Map<string, typeof setRows>();
  for (const s of setRows) setsBy.set(s.matchId, [...(setsBy.get(s.matchId) ?? []), s]);

  const dict = dictionary('en');
  const date = venueDateFormatter('en');
  const time = venueTimeFormatter('en');

  const body = toCsv(
    [
      'tournament',
      'draw',
      'round',
      'date',
      'time',
      'court',
      'side1',
      'side2',
      'score',
      'winner',
      'outcome',
      'status',
    ],
    rows.map((r) => {
      const mine = sidesBy.get(r.id) ?? [];
      const nameAt = (position: number): string => {
        const side = mine.find((s) => s.position === position);
        return side?.entrantId == null ? '' : (nameBy.get(side.entrantId) ?? '');
      };
      const sets = setsBy.get(r.id) ?? [];
      // One column, the way a result is written down: "6-3 7-6(5)".
      const score = sets
        .map((s) => {
          const loserTb = Math.min(s.side0TiebreakPoints ?? -1, s.side1TiebreakPoints ?? -1);
          return `${s.side0Games}-${s.side1Games}${loserTb < 0 ? '' : `(${loserTb})`}`;
        })
        .join(' ');
      const winner =
        r.winnerEntrantId === null ? '' : (nameBy.get(r.winnerEntrantId) ?? '');

      return [
        tournament.name,
        drawLabel(r.categoryCode, r.division as Division, r.discipline as Discipline, dict),
        r.roundName ?? '',
        r.scheduledAt === null ? '' : date.format(r.scheduledAt),
        r.scheduledAt === null ? '' : time.format(r.scheduledAt),
        r.courtName ?? '',
        nameAt(0),
        nameAt(1),
        score,
        winner,
        outcomeAbbreviation(r.outcome) ?? (r.outcome ?? ''),
        r.status,
      ];
    }),
  );

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}-results.csv"`,
      'cache-control': 'no-store',
    },
  });
}
