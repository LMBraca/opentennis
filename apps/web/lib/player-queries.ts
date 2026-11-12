/**
 * Public reads about PEOPLE rather than about draws.
 *
 * The bracket answers "how is this category going". These answer the
 * questions a member actually opens their phone for: when am I on, who did
 * I play, how did the person who knocked me out get on.
 *
 * Every query here filters to tournaments the public can see. A draft is an
 * organizer's unfinished work and must not leak through a player page or a
 * search box — the same rule the draw queries follow, restated because this
 * is a second way into the same data.
 */

import 'server-only';
import { and, asc, desc, eq, inArray, ne, or } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from './db';
import { fold, isDevelopmentFixturePlayer } from './player-name';
import { reconcileScheduleDisplay, type ScheduleDisplayMatch, type ScheduleDisplaySide } from './schedule-display';

/** Draft tournaments are invisible to everyone but their organizer. */
const PUBLIC_VISIBILITY = ['public', 'unlisted'] as const;

export interface MatchSideView {
  readonly position: number;
  readonly entrantId: string | null;
  readonly name: string | null;
  readonly seed: number | null;
  readonly isWinner: boolean;
  readonly isBye: boolean;
  /**
   * RV-4b. The people behind the entrant — one for singles, two for
   * doubles — so a match can link into each player's history.
   *
   * Separate from `name`, which is the bracket's joined surname string and
   * deliberately not parseable back into people: "Alvarez / Chen" splits
   * wrong the moment somebody has a space in their surname.
   */
  readonly players: ReadonlyArray<{ readonly id: string; readonly lastName: string }>;
}

export interface MatchDetail {
  readonly id: string;
  readonly status: string;
  readonly outcome: string | null;
  readonly scheduledAt: Date | null;
  readonly courtName: string | null;
  readonly roundName: string;
  readonly roundIndex: number;
  readonly tournamentName: string;
  readonly tournamentSlug: string;
  readonly categoryCode: string;
  readonly categorySlug: string;
  readonly discipline: string;
  readonly division: string;
  readonly sides: readonly MatchSideView[];
  readonly sets: ReadonlyArray<{
    readonly setIndex: number;
    readonly side0Games: number;
    readonly side1Games: number;
    readonly side0TiebreakPoints: number | null;
    readonly side1TiebreakPoints: number | null;
  }>;
}

/**
 * The people in each entrant, in display order.
 *
 * RV-4b widened this from a surname string to the rows themselves. The
 * joined "Alvarez / Chen" a bracket shows is now derived from this rather
 * than being the only thing fetched, because splitting it back apart to
 * find two player ids breaks on any surname containing a space.
 */
async function playersByEntrant(
  entrantIds: readonly string[],
): Promise<Map<string, Array<{ id: string; lastName: string }>>> {
  const out = new Map<string, Array<{ id: string; lastName: string }>>();
  if (entrantIds.length === 0) return out;

  const rows = await db()
    .select({
      entrantId: schema.entrantPlayers.entrantId,
      playerId: schema.players.id,
      lastName: schema.players.lastName,
    })
    .from(schema.entrantPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .where(inArray(schema.entrantPlayers.entrantId, [...entrantIds]))
    .orderBy(asc(schema.entrantPlayers.position));

  for (const row of rows) {
    const list = out.get(row.entrantId) ?? [];
    list.push({ id: row.playerId, lastName: row.lastName });
    out.set(row.entrantId, list);
  }
  return out;
}

/** Surnames only, joined for a doubles pair — what a bracket shows. */
function joinedName(people: ReadonlyArray<{ lastName: string }> | undefined): string | null {
  if (people === undefined || people.length === 0) return null;
  return people.map((p) => p.lastName).join(' / ');
}

async function hydrate(
  rows: ReadonlyArray<{
    id: string;
    status: string;
    outcome: string | null;
    winnerEntrantId: string | null;
    scheduledAt: Date | null;
    courtName: string | null;
    roundName: string | null;
    roundIndex: number | null;
    tournamentName: string;
    tournamentSlug: string;
    categoryCode: string;
    categorySlug: string;
    discipline: string;
    division: string;
    eventId: string;
    matchMinutes: number;
    minRestMinutes: number;
  }>,
): Promise<MatchDetail[]> {
  if (rows.length === 0) return [];
  const eventIds = [...new Set(rows.map((row) => row.eventId))];
  const allMatchRows = await db()
    .select({
      id: schema.matches.id,
      eventId: schema.matches.eventId,
      groupId: schema.rounds.groupId,
      status: schema.matches.status,
      winnerEntrantId: schema.matches.winnerEntrantId,
      scheduledAt: schema.matches.scheduledAt,
      completedAt: schema.matches.completedAt,
      courtName: schema.courts.name,
    })
    .from(schema.matches)
    .leftJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .leftJoin(schema.courts, eq(schema.courts.id, schema.matches.courtId))
    .where(inArray(schema.matches.eventId, eventIds));
  const matchIds = allMatchRows.map((row) => row.id);

  const sideRows = await db()
    .select({
      id: schema.matchSides.id,
      matchId: schema.matchSides.matchId,
      position: schema.matchSides.position,
      entrantId: schema.matchSides.entrantId,
      sourceKind: schema.matchSides.sourceKind,
      sourceMatchId: schema.matchSides.sourceMatchId,
      sourceGroupId: schema.matchSides.sourceGroupId,
      seed: schema.entrants.seed,
    })
    .from(schema.matchSides)
    .leftJoin(schema.entrants, eq(schema.entrants.id, schema.matchSides.entrantId))
    .where(inArray(schema.matchSides.matchId, matchIds))
    .orderBy(asc(schema.matchSides.position));

  const configs = new Map(
    rows.map((row) => [
      row.eventId,
      { matchMinutes: row.matchMinutes, minRestMinutes: row.minRestMinutes },
    ]),
  );
  const presentation = reconcileScheduleDisplay(
    allMatchRows as ScheduleDisplayMatch[],
    sideRows as ScheduleDisplaySide[],
    configs,
  );
  const presentedRows = rows.map((row) => ({
    ...row,
    ...presentation.matches.get(row.id),
  }));
  const presentedSides = sideRows.map((side) => ({
    ...side,
    entrantId: presentation.sides.find((candidate) => candidate.id === side.id)?.entrantId ?? null,
  }));

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
    .where(inArray(schema.sets.matchId, matchIds))
    .orderBy(asc(schema.sets.setIndex));

  const people = await playersByEntrant(
    presentedSides.map((s) => s.entrantId).filter((id): id is string => id !== null),
  );

  const sidesBy = new Map<string, MatchSideView[]>();
  for (const side of presentedSides) {
    const winnerId =
      presentedRows.find((r) => r.id === side.matchId)?.winnerEntrantId ?? null;
    const list = sidesBy.get(side.matchId) ?? [];
    list.push({
      position: side.position,
      entrantId: side.entrantId,
      name: side.entrantId === null ? null : joinedName(people.get(side.entrantId)),
      seed: side.seed,
      isWinner: winnerId !== null && side.entrantId === winnerId,
      isBye: side.sourceKind === 'bye',
      players: side.entrantId === null ? [] : (people.get(side.entrantId) ?? []),
    });
    sidesBy.set(side.matchId, list);
  }

  const setsBy = new Map<string, MatchDetail['sets'][number][]>();
  for (const set of setRows) {
    const list = setsBy.get(set.matchId) ?? [];
    list.push({
      setIndex: set.setIndex,
      side0Games: set.side0Games,
      side1Games: set.side1Games,
      side0TiebreakPoints: set.side0TiebreakPoints,
      side1TiebreakPoints: set.side1TiebreakPoints,
    });
    setsBy.set(set.matchId, list);
  }

  return presentedRows.map((r) => ({
    id: r.id,
    status: r.status,
    outcome: r.outcome,
    scheduledAt: r.scheduledAt,
    courtName: r.courtName,
    roundName: r.roundName ?? '',
    roundIndex: r.roundIndex ?? 0,
    tournamentName: r.tournamentName,
    tournamentSlug: r.tournamentSlug,
    categoryCode: r.categoryCode,
    categorySlug: r.categorySlug,
    discipline: r.discipline,
    division: r.division,
    sides: sidesBy.get(r.id) ?? [],
    sets: setsBy.get(r.id) ?? [],
  }));
}

const MATCH_COLUMNS = {
  id: schema.matches.id,
  eventId: schema.matches.eventId,
  matchMinutes: schema.tournaments.matchMinutes,
  minRestMinutes: schema.tournaments.minRestMinutes,
  status: schema.matches.status,
  outcome: schema.matches.outcome,
  winnerEntrantId: schema.matches.winnerEntrantId,
  scheduledAt: schema.matches.scheduledAt,
  courtName: schema.courts.name,
  roundName: schema.rounds.name,
  roundIndex: schema.rounds.roundIndex,
  tournamentName: schema.tournaments.name,
  tournamentSlug: schema.tournaments.slug,
  categoryCode: schema.categories.code,
  categorySlug: schema.categories.slug,
  discipline: schema.events.discipline,
  division: schema.events.division,
} as const;

function matchQuery() {
  return db()
    .select(MATCH_COLUMNS)
    .from(schema.matches)
    .innerJoin(schema.events, eq(schema.events.id, schema.matches.eventId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.matches.tournamentId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .leftJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .leftJoin(schema.courts, eq(schema.courts.id, schema.matches.courtId));
}

/** PUB-6. One match, or null if it is not public. */
export async function loadMatch(matchId: string): Promise<MatchDetail | null> {
  const rows = await matchQuery()
    .where(
      and(
        eq(schema.matches.organizationId, orgId()),
        eq(schema.matches.id, matchId),
        inArray(schema.tournaments.visibility, [...PUBLIC_VISIBILITY]),
      ),
    )
    .limit(1);

  const [detail] = await hydrate(rows);
  return detail ?? null;
}

export interface PlayerProfile {
  readonly id: string;
  readonly name: string;
  /**
   * Every entrant row this person is part of, across tournaments.
   *
   * Needed to answer "did they win this one": a player is not an entrant,
   * and in doubles the winning side is a pair. Without this the caller has
   * to guess, and the obvious guess — "is one side the winner" — is true of
   * every completed match.
   */
  readonly entrantIds: readonly string[];
  readonly matches: readonly MatchDetail[];
  readonly entries: ReadonlyArray<{
    readonly entrantId: string;
    readonly tournamentName: string;
    readonly tournamentSlug: string;
    readonly categorySlug: string;
    readonly categoryCode: string;
    readonly discipline: string;
    readonly division: string;
    readonly seed: number | null;
  }>;
}

/**
 * PUB-9. One player across every public tournament.
 *
 * This is what ADM-14's merge was for: before it, the same person entered
 * twice was two players and this page could only ever show half a history.
 */
export async function loadPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
  const [player] = await db()
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
    })
    .from(schema.players)
    .where(and(eq(schema.players.organizationId, orgId()), eq(schema.players.id, playerId)))
    .limit(1);

  if (player === undefined) return null;

  const entryRows = await db()
    .select({
      entrantId: schema.entrants.id,
      seed: schema.entrants.seed,
      tournamentName: schema.tournaments.name,
      tournamentSlug: schema.tournaments.slug,
      categorySlug: schema.categories.slug,
      categoryCode: schema.categories.code,
      discipline: schema.events.discipline,
      division: schema.events.division,
      startDate: schema.tournaments.startDate,
    })
    .from(schema.entrantPlayers)
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(
      and(
        eq(schema.entrantPlayers.playerId, playerId),
        inArray(schema.tournaments.visibility, [...PUBLIC_VISIBILITY]),
      ),
    )
    .orderBy(desc(schema.tournaments.startDate));

  const entrantIds = entryRows.map((r) => r.entrantId);

  const matchRows =
    entrantIds.length === 0
      ? []
      : await matchQuery()
          .innerJoin(schema.matchSides, eq(schema.matchSides.matchId, schema.matches.id))
          .where(
            and(
              inArray(schema.matchSides.entrantId, entrantIds),
              inArray(schema.tournaments.visibility, [...PUBLIC_VISIBILITY]),
              // A bye is not a match anybody played.
              ne(schema.matches.status, 'bye'),
            ),
          )
          .orderBy(desc(schema.tournaments.startDate), asc(schema.rounds.roundIndex));

  return {
    id: player.id,
    name: `${player.firstName} ${player.lastName}`.trim(),
    entrantIds: entrantIds,
    matches: await hydrate(matchRows),
    entries: entryRows.map((r) => ({
      // OT-15. Exposed so the profile can link to THIS entrant's path
      // through the draw. It was already selected and then dropped, which
      // is why the profile could only link to the draw as a whole.
      entrantId: r.entrantId,
      tournamentName: r.tournamentName,
      tournamentSlug: r.tournamentSlug,
      categorySlug: r.categorySlug,
      categoryCode: r.categoryCode,
      discipline: r.discipline,
      division: r.division,
      seed: r.seed,
    })),
  };
}

/**
 * PUB-5. One ENTRANT's run through a draw, in round order.
 *
 * Keyed by entrant rather than player because the entrant is the draw's
 * unit: a doubles pair plays as one thing, and a path keyed by person would
 * have to pick which half of the pair it meant.
 */
export async function loadPath(entrantId: string): Promise<readonly MatchDetail[]> {
  const entrantEvents = await db()
    .select({ eventId: schema.entrants.eventId })
    .from(schema.entrants)
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .where(
      and(
        eq(schema.entrants.id, entrantId),
        inArray(schema.tournaments.visibility, [...PUBLIC_VISIBILITY]),
      ),
    );
  const eventIds = entrantEvents.map((row) => row.eventId);
  if (eventIds.length === 0) return [];

  const rows = await matchQuery()
    .where(
      and(
        inArray(schema.matches.eventId, eventIds),
        inArray(schema.tournaments.visibility, [...PUBLIC_VISIBILITY]),
      ),
    )
    .orderBy(asc(schema.rounds.roundIndex));

  return (await hydrate(rows)).filter((match) =>
    match.sides.some((side) => side.entrantId === entrantId),
  );
}

export interface EntrantHit {
  readonly playerId: string;
  readonly name: string;
  readonly tournaments: readonly string[];
}

/**
 * PUB-10. Find a person in the public draws.
 *
 * Matching happens in JS on folded names rather than with SQL `ilike`,
 * because Postgres would not match "hernandez" against "Hernández" without
 * an unaccent extension — and most people searching for themselves type it
 * without the accent. A club roster is hundreds of rows, not millions.
 */
export async function searchEntrants(query: string, limit = 25): Promise<EntrantHit[]> {
  const needle = fold(query).replace(/\s+/g, ' ').trim();
  if (needle === '') return [];

  const rows = await db()
    .select({
      playerId: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      tournamentName: schema.tournaments.name,
    })
    .from(schema.entrantPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .where(
      and(
        eq(schema.players.organizationId, orgId()),
        inArray(schema.tournaments.visibility, [...PUBLIC_VISIBILITY]),
      ),
    )
    .orderBy(asc(schema.players.lastName), asc(schema.players.firstName));

  const terms = needle.split(' ');
  const byPlayer = new Map<string, EntrantHit>();

  for (const row of rows) {
    if (isDevelopmentFixturePlayer(row.firstName, row.lastName)) continue;

    const haystack = fold(`${row.firstName} ${row.lastName}`);
    const reversed = fold(`${row.lastName} ${row.firstName}`);
    if (!terms.every((t) => haystack.includes(t) || reversed.includes(t))) continue;

    const existing = byPlayer.get(row.playerId);
    if (existing === undefined) {
      byPlayer.set(row.playerId, {
        playerId: row.playerId,
        name: `${row.lastName}, ${row.firstName}`,
        tournaments: [row.tournamentName],
      });
    } else if (!existing.tournaments.includes(row.tournamentName)) {
      byPlayer.set(row.playerId, {
        ...existing,
        tournaments: [...existing.tournaments, row.tournamentName],
      });
    }
    if (byPlayer.size >= limit) break;
  }

  return [...byPlayer.values()];
}

/** Everyone in a draw, for the path-view picker. */
export async function listDrawEntrants(
  tournamentSlug: string,
  categorySlug: string,
  discipline: string,
  division: string,
): Promise<ReadonlyArray<{ entrantId: string; name: string }>> {
  const rows = await db()
    .select({
      entrantId: schema.entrants.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
    })
    .from(schema.entrantPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(
      and(
        eq(schema.tournaments.slug, tournamentSlug),
        eq(schema.categories.slug, categorySlug),
        eq(schema.events.discipline, discipline as 'singles'),
        eq(schema.events.division, division as 'open'),
        inArray(schema.tournaments.visibility, [...PUBLIC_VISIBILITY]),
        or(eq(schema.entrants.status, 'active'), eq(schema.entrants.status, 'withdrawn')),
      ),
    )
    .orderBy(asc(schema.players.lastName), asc(schema.players.firstName));

  // A doubles entrant yields two rows; fold them into one option.
  const byEntrant = new Map<string, string>();
  const fixtureEntrants = new Set<string>();
  for (const r of rows) {
    if (isDevelopmentFixturePlayer(r.firstName, r.lastName)) {
      fixtureEntrants.add(r.entrantId);
      continue;
    }

    const existing = byEntrant.get(r.entrantId);
    const name = `${r.lastName}, ${r.firstName}`;
    byEntrant.set(r.entrantId, existing === undefined ? name : `${existing} / ${r.lastName}`);
  }
  return [...byEntrant.entries()]
    .filter(([entrantId]) => !fixtureEntrants.has(entrantId))
    .map(([entrantId, name]) => ({ entrantId, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
