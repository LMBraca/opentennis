/**
 * Read queries for the public site.
 *
 * Kept together so the shape of each page's data is obvious in one place, and
 * so N+1 patterns are visible rather than buried in components.
 */

import 'server-only';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from './db';

export interface TournamentSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly venue: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: string;
  readonly drawCount: number;
  readonly entrantCount: number;
  readonly liveCount: number;
}

/** Tournaments visible to the public, newest first. */
export async function listTournaments(): Promise<TournamentSummary[]> {
  const organizationId = orgId();

  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      slug: schema.tournaments.slug,
      venue: schema.tournaments.venue,
      startDate: schema.tournaments.startDate,
      endDate: schema.tournaments.endDate,
      status: schema.tournaments.status,
    })
    .from(schema.tournaments)
    .where(
      and(
        eq(schema.tournaments.organizationId, organizationId),
        inArray(schema.tournaments.visibility, ['public', 'unlisted']),
      ),
    )
    .orderBy(asc(schema.tournaments.startDate));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Three grouped queries rather than three subqueries per row.
  const drawCounts = await db()
    .select({ tournamentId: schema.events.tournamentId, n: count(schema.events.id) })
    .from(schema.events)
    .where(inArray(schema.events.tournamentId, ids))
    .groupBy(schema.events.tournamentId);

  const entrantCounts = await db()
    .select({ tournamentId: schema.events.tournamentId, n: count(schema.entrants.id) })
    .from(schema.events)
    .innerJoin(schema.entrants, eq(schema.entrants.eventId, schema.events.id))
    .where(
      and(
        inArray(schema.events.tournamentId, ids),
        eq(schema.entrants.status, 'active'),
      ),
    )
    .groupBy(schema.events.tournamentId);

  const liveCounts = await db()
    .select({ tournamentId: schema.matches.tournamentId, n: count(schema.matches.id) })
    .from(schema.matches)
    .where(
      and(
        inArray(schema.matches.tournamentId, ids),
        eq(schema.matches.status, 'live'),
      ),
    )
    .groupBy(schema.matches.tournamentId);

  const draws = new Map(drawCounts.map((r) => [r.tournamentId, r.n]));
  const entrantsBy = new Map(entrantCounts.map((r) => [r.tournamentId, r.n]));
  const liveBy = new Map(liveCounts.map((r) => [r.tournamentId, r.n]));

  return rows.map((r) => ({
    ...r,
    drawCount: draws.get(r.id) ?? 0,
    entrantCount: entrantsBy.get(r.id) ?? 0,
    liveCount: liveBy.get(r.id) ?? 0,
  }));
}

/* ------------------------------------------------------------------------- */
/* A single draw                                                             */
/* ------------------------------------------------------------------------- */

export interface DrawSide {
  readonly position: number;
  readonly entrantId: string | null;
  /** "Alvarez" or "Alvarez / Chen". Null when undecided. */
  readonly name: string | null;
  readonly seed: number | null;
  readonly sourceLabel: string | null;
}

export interface DrawMatch {
  readonly id: string;
  readonly engineMatchId: string;
  readonly slotIndex: number;
  readonly status: string;
  readonly outcome: string | null;
  readonly winnerEntrantId: string | null;
  readonly sides: readonly DrawSide[];
  readonly sets: ReadonlyArray<{
    readonly side0Games: number;
    readonly side1Games: number;
    readonly side0TiebreakPoints: number | null;
    readonly side1TiebreakPoints: number | null;
  }>;
}

export interface DrawRound {
  readonly id: string;
  readonly name: string;
  readonly roundIndex: number;
  readonly kind: string;
  readonly groupId: string | null;
  readonly matches: readonly DrawMatch[];
}

export interface DrawView {
  readonly tournament: { id: string; name: string; slug: string; venue: string | null };
  readonly category: { id: string; code: string; slug: string; rank: number };
  readonly discipline: 'singles' | 'doubles';
  readonly division: 'open' | 'mens' | 'womens';
  readonly event: { id: string; format: string; status: string };
  readonly stage: { id: string; kind: string; description: string | null } | null;
  readonly rounds: readonly DrawRound[];
  readonly groups: ReadonlyArray<{ id: string; name: string }>;
  readonly entrantCount: number;
}

/** Human label for an undecided slot: "Winner of QF2", "Group 2 · 1st". */
function sourceLabelFor(
  kind: string | null,
  sourceMatchId: string | null,
  sourceRank: number | null,
  roundNameByMatchId: ReadonlyMap<string, string>,
  slotByMatchId: ReadonlyMap<string, number>,
  groupNameById: ReadonlyMap<string, string>,
  sourceGroupId: string | null,
): string | null {
  if (kind === 'bye') return 'Bye';
  if (kind === 'groupRank' && sourceGroupId !== null) {
    const group = groupNameById.get(sourceGroupId) ?? 'Group';
    const ordinal = sourceRank === 1 ? '1st' : sourceRank === 2 ? '2nd' : `${sourceRank}th`;
    return `${group} · ${ordinal}`;
  }
  if ((kind === 'winnerOf' || kind === 'loserOf') && sourceMatchId !== null) {
    const round = roundNameByMatchId.get(sourceMatchId);
    const slot = slotByMatchId.get(sourceMatchId);
    const verb = kind === 'winnerOf' ? 'Winner' : 'Loser';
    if (round === undefined) return `${verb} of previous match`;
    // "Winner of QF2" reads better than "Winner of Quarterfinal match 2".
    // A hyphen is required when the abbreviation itself ends in a digit,
    // otherwise "R16" + slot 2 renders as "R162".
    const short =
      round === 'Final' ? 'F' :
      round === 'Semifinal' ? 'SF' :
      round === 'Quarterfinal' ? 'QF' :
      round.replace('Round of ', 'R');
    if (slot === undefined) return `${verb} of ${short}`;
    const separator = /\d$/.test(short) ? '-' : '';
    return `${verb} of ${short}${separator}${slot + 1}`;
  }
  return null;
}

export async function loadDraw(
  tournamentSlug: string,
  categorySlug: string,
  discipline: 'singles' | 'doubles',
  division: 'open' | 'mens' | 'womens' = 'open',
): Promise<DrawView | null> {
  const organizationId = orgId();

  const found = await db()
    .select({
      tournamentId: schema.tournaments.id,
      tournamentName: schema.tournaments.name,
      tournamentSlug: schema.tournaments.slug,
      venue: schema.tournaments.venue,
      visibility: schema.tournaments.visibility,
      categoryId: schema.categories.id,
      categoryCode: schema.categories.code,
      categorySlug: schema.categories.slug,
      categoryRank: schema.categories.rank,
      eventId: schema.events.id,
      format: schema.events.format,
      eventStatus: schema.events.status,
      division: schema.events.division,
    })
    .from(schema.events)
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(
      and(
        eq(schema.events.organizationId, organizationId),
        eq(schema.tournaments.slug, tournamentSlug),
        eq(schema.categories.slug, categorySlug),
        eq(schema.events.discipline, discipline),
        eq(schema.events.division, division),
      ),
    )
    .limit(1);

  const head = found[0];
  if (head === undefined || head.visibility === 'draft') return null;

  const [stageRow] = await db()
    .select({ id: schema.stages.id, kind: schema.stages.kind, config: schema.stages.config })
    .from(schema.stages)
    .where(eq(schema.stages.eventId, head.eventId))
    .orderBy(asc(schema.stages.sortOrder))
    .limit(1);

  const entrantTotal = await db()
    .select({ n: count(schema.entrants.id) })
    .from(schema.entrants)
    .where(
      and(eq(schema.entrants.eventId, head.eventId), eq(schema.entrants.status, 'active')),
    );

  const base = {
    tournament: {
      id: head.tournamentId,
      name: head.tournamentName,
      slug: head.tournamentSlug,
      venue: head.venue,
    },
    category: {
      id: head.categoryId,
      code: head.categoryCode,
      slug: head.categorySlug,
      rank: head.categoryRank,
    },
    discipline,
    division: head.division as 'open',
    event: { id: head.eventId, format: head.format, status: head.eventStatus },
    entrantCount: entrantTotal[0]?.n ?? 0,
  };

  if (stageRow === undefined) {
    return { ...base, stage: null, rounds: [], groups: [] };
  }

  const config = stageRow.config as { description?: string } | null;

  const groupRows = await db()
    .select({ id: schema.groups.id, name: schema.groups.name })
    .from(schema.groups)
    .where(eq(schema.groups.stageId, stageRow.id))
    .orderBy(asc(schema.groups.sortOrder));

  const roundRows = await db()
    .select({
      id: schema.rounds.id,
      name: schema.rounds.name,
      roundIndex: schema.rounds.roundIndex,
      kind: schema.rounds.kind,
      groupId: schema.rounds.groupId,
    })
    .from(schema.rounds)
    .where(eq(schema.rounds.stageId, stageRow.id))
    .orderBy(asc(schema.rounds.roundIndex));

  if (roundRows.length === 0) {
    return { ...base, stage: { id: stageRow.id, kind: stageRow.kind, description: config?.description ?? null }, rounds: [], groups: groupRows };
  }

  const roundIds = roundRows.map((r) => r.id);

  const matchRows = await db()
    .select({
      id: schema.matches.id,
      roundId: schema.matches.roundId,
      engineMatchId: schema.matches.engineMatchId,
      slotIndex: schema.matches.slotIndex,
      status: schema.matches.status,
      outcome: schema.matches.outcome,
      winnerEntrantId: schema.matches.winnerEntrantId,
    })
    .from(schema.matches)
    .where(inArray(schema.matches.roundId, roundIds))
    .orderBy(asc(schema.matches.slotIndex));

  const matchIds = matchRows.map((m) => m.id);

  const sideRows =
    matchIds.length === 0
      ? []
      : await db()
          .select({
            matchId: schema.matchSides.matchId,
            position: schema.matchSides.position,
            entrantId: schema.matchSides.entrantId,
            sourceKind: schema.matchSides.sourceKind,
            sourceMatchId: schema.matchSides.sourceMatchId,
            sourceGroupId: schema.matchSides.sourceGroupId,
            sourceRank: schema.matchSides.sourceRank,
          })
          .from(schema.matchSides)
          .where(inArray(schema.matchSides.matchId, matchIds))
          .orderBy(asc(schema.matchSides.position));

  const setRows =
    matchIds.length === 0
      ? []
      : await db()
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

  // Entrant display names, assembled once. A doubles entrant is "A / B".
  const entrantRows = await db()
    .select({
      entrantId: schema.entrants.id,
      seed: schema.entrants.seed,
      position: schema.entrantPlayers.position,
      lastName: schema.players.lastName,
      firstName: schema.players.firstName,
    })
    .from(schema.entrants)
    .innerJoin(schema.entrantPlayers, eq(schema.entrantPlayers.entrantId, schema.entrants.id))
    .innerJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .where(eq(schema.entrants.eventId, head.eventId))
    .orderBy(asc(schema.entrantPlayers.position));

  const nameParts = new Map<string, string[]>();
  const seedBy = new Map<string, number | null>();
  for (const r of entrantRows) {
    const list = nameParts.get(r.entrantId) ?? [];
    list.push(r.lastName);
    nameParts.set(r.entrantId, list);
    seedBy.set(r.entrantId, r.seed);
  }
  const nameBy = new Map([...nameParts].map(([id, parts]) => [id, parts.join(' / ')]));

  const roundNameByMatchId = new Map<string, string>();
  const slotByMatchId = new Map<string, number>();
  const roundById = new Map(roundRows.map((r) => [r.id, r]));
  for (const m of matchRows) {
    const round = roundById.get(m.roundId);
    if (round !== undefined) roundNameByMatchId.set(m.id, round.name);
    slotByMatchId.set(m.id, m.slotIndex);
  }
  const groupNameById = new Map(groupRows.map((g) => [g.id, g.name]));

  const sidesByMatch = new Map<string, DrawSide[]>();
  for (const s of sideRows) {
    const list = sidesByMatch.get(s.matchId) ?? [];
    list.push({
      position: s.position,
      entrantId: s.entrantId,
      name: s.entrantId === null ? null : (nameBy.get(s.entrantId) ?? null),
      seed: s.entrantId === null ? null : (seedBy.get(s.entrantId) ?? null),
      sourceLabel: sourceLabelFor(
        s.sourceKind,
        s.sourceMatchId,
        s.sourceRank,
        roundNameByMatchId,
        slotByMatchId,
        groupNameById,
        s.sourceGroupId,
      ),
    });
    sidesByMatch.set(s.matchId, list);
  }

  const setsByMatch = new Map<string, DrawMatch['sets'][number][]>();
  for (const s of setRows) {
    const list = setsByMatch.get(s.matchId) ?? [];
    list.push({
      side0Games: s.side0Games,
      side1Games: s.side1Games,
      side0TiebreakPoints: s.side0TiebreakPoints,
      side1TiebreakPoints: s.side1TiebreakPoints,
    });
    setsByMatch.set(s.matchId, list);
  }

  const matchesByRound = new Map<string, DrawMatch[]>();
  for (const m of matchRows) {
    const list = matchesByRound.get(m.roundId) ?? [];
    list.push({
      id: m.id,
      engineMatchId: m.engineMatchId,
      slotIndex: m.slotIndex,
      status: m.status,
      outcome: m.outcome,
      winnerEntrantId: m.winnerEntrantId,
      sides: (sidesByMatch.get(m.id) ?? []).sort((a, b) => a.position - b.position),
      sets: setsByMatch.get(m.id) ?? [],
    });
    matchesByRound.set(m.roundId, list);
  }

  const rounds: DrawRound[] = roundRows.map((r) => ({
    id: r.id,
    name: r.name,
    roundIndex: r.roundIndex,
    kind: r.kind,
    groupId: r.groupId,
    matches: (matchesByRound.get(r.id) ?? []).sort((a, b) => a.slotIndex - b.slotIndex),
  }));

  return {
    ...base,
    stage: { id: stageRow.id, kind: stageRow.kind, description: config?.description ?? null },
    rounds,
    groups: groupRows,
  };
}

/** Every draw in a tournament, for the category switcher. */
export async function listDraws(
  tournamentId: string,
): Promise<
  Array<{
    categorySlug: string;
    categoryCode: string;
    rank: number;
    discipline: string;
    division: string;
    status: string;
  }>
> {
  const rows = await db()
    .select({
      categorySlug: schema.categories.slug,
      categoryCode: schema.categories.code,
      rank: schema.categories.rank,
      discipline: schema.events.discipline,
      division: schema.events.division,
      status: schema.events.status,
    })
    .from(schema.events)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(eq(schema.events.tournamentId, tournamentId))
    .orderBy(asc(schema.categories.rank), asc(schema.events.discipline));
  return rows;
}

/* ------------------------------------------------------------------------- */
/* Home page                                                                 */
/* ------------------------------------------------------------------------- */

export interface DrawPreview {
  readonly categoryCode: string;
  readonly categorySlug: string;
  readonly discipline: string;
  readonly division: string;
  readonly format: string;
  readonly entrantCount: number;
  readonly liveCount: number;
}

/**
 * The draws of one tournament, for the home page card.
 *
 * Deliberately a summary rather than a bracket: a full draw on the home page
 * would be unreadable at that size and would make the page cost as much as
 * the draw page it links to.
 */
export async function drawPreviews(tournamentId: string): Promise<DrawPreview[]> {
  const rows = await db()
    .select({
      categoryCode: schema.categories.code,
      categorySlug: schema.categories.slug,
      rank: schema.categories.rank,
      discipline: schema.events.discipline,
      division: schema.events.division,
      format: schema.events.format,
      eventId: schema.events.id,
      entrantCount: count(schema.entrants.id),
    })
    .from(schema.events)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .leftJoin(
      schema.entrants,
      and(eq(schema.entrants.eventId, schema.events.id), eq(schema.entrants.status, 'active')),
    )
    .where(
      and(
        eq(schema.events.tournamentId, tournamentId),
        inArray(schema.events.status, ['published', 'inProgress', 'complete']),
      ),
    )
    .groupBy(
      schema.events.id,
      schema.categories.code,
      schema.categories.slug,
      schema.categories.rank,
      schema.events.discipline,
      schema.events.division,
      schema.events.format,
    )
    .orderBy(asc(schema.categories.rank));

  const live = await db()
    .select({ eventId: schema.matches.eventId, n: count(schema.matches.id) })
    .from(schema.matches)
    .where(
      and(eq(schema.matches.tournamentId, tournamentId), eq(schema.matches.status, 'live')),
    )
    .groupBy(schema.matches.eventId);
  const liveBy = new Map(live.map((r) => [r.eventId, r.n]));

  return rows.map((r) => ({
    categoryCode: r.categoryCode,
    categorySlug: r.categorySlug,
    discipline: r.discipline,
    division: r.division,
    format: r.format,
    entrantCount: r.entrantCount,
    liveCount: liveBy.get(r.eventId) ?? 0,
  }));
}
