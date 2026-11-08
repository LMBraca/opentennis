/**
 * Read queries for the public site.
 *
 * Kept together so the shape of each page's data is obvious in one place, and
 * so N+1 patterns are visible rather than buried in components.
 */

import 'server-only';
import { and, asc, count, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from './db';
import type { DrawSource, StageSummaryConfig } from './draw-text';
import { drawSegment, type Discipline, type Division } from './divisions';
import { reconcileScheduleDisplay } from './schedule-display';

export interface TournamentSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly venue: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: string;
  /** 'draft' | 'unlisted' | 'public'. Only the admin list ever sees 'draft'. */
  readonly visibility: string;
  readonly drawCount: number;
  readonly entrantCount: number;
  readonly liveCount: number;
}

/** Tournaments visible to the public, newest first. */
export async function listTournaments(): Promise<TournamentSummary[]> {
  return tournamentsWhere(['public', 'unlisted']);
}

/**
 * Every tournament, drafts included — for the admin dashboard only.
 *
 * The dashboard used to call listTournaments(), which filters drafts out.
 * The effect was that creating a tournament and not publishing it made it
 * VANISH from the only page that could edit it: the row was gone, and the
 * only way back was to know the slug. An admin tool that hides your own
 * unpublished work is worse than no tool.
 */
export async function listTournamentsForAdmin(): Promise<TournamentSummary[]> {
  return tournamentsWhere(['public', 'unlisted', 'draft']);
}

async function tournamentsWhere(
  visibilities: readonly ('public' | 'unlisted' | 'draft')[],
): Promise<TournamentSummary[]> {
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
      visibility: schema.tournaments.visibility,
    })
    .from(schema.tournaments)
    .where(
      and(
        eq(schema.tournaments.organizationId, organizationId),
        inArray(schema.tournaments.visibility, [...visibilities]),
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
  /**
   * Where this slot's occupant comes from, when it is still undecided.
   * Structured, not a sentence: this query does not know the reader's
   * language. Render it with `sourceText` from lib/draw-text.
   */
  readonly source: DrawSource | null;
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
  readonly tournament: {
    id: string;
    name: string;
    slug: string;
    venue: string | null;
    /** Drives whether the page subscribes to live updates (SCR-8). */
    status: string;
  };
  readonly category: { id: string; code: string; slug: string; rank: number };
  readonly discipline: 'singles' | 'doubles';
  readonly division: 'open' | 'mens' | 'womens';
  readonly event: { id: string; format: string; status: string };
  readonly stage: {
    readonly id: string;
    readonly kind: string;
    /**
     * The engine's English sentence. Prefer `summary`, which is the same
     * facts rebuilt in the reader's language; this remains for the stages
     * persisted before those facts were stored.
     */
    readonly description: string | null;
    /** The counts the summary is rebuilt from. See lib/draw-text. */
    readonly summary: StageSummaryConfig;
  } | null;
  readonly rounds: readonly DrawRound[];
  readonly groups: ReadonlyArray<{ id: string; name: string }>;
  readonly entrantCount: number;
  /**
   * The second bracket, for first-round losers. Null unless the club asked
   * for one and there were enough losers to fill it.
   */
  readonly consolation: {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly rounds: readonly DrawRound[];
    /**
     * How many players the bracket is actually for — the first-round
     * losers that feed it, which is smaller than the main draw's entrant
     * count and is the number a printed sheet should carry.
     */
    readonly feederCount: number;
  } | null;
}

/**
 * What an undecided slot is waiting on.
 *
 * Returns structure, not prose. This used to return "Winner of QF2" — an
 * English sentence baked into a data query, which then appeared verbatim on
 * a Spanish page, and which the draw sheet tested with `=== 'Bye'`.
 */
function sourceFor(
  kind: string | null,
  sourceMatchId: string | null,
  sourceRank: number | null,
  roundNameByMatchId: ReadonlyMap<string, string>,
  slotByMatchId: ReadonlyMap<string, number>,
  groupNameById: ReadonlyMap<string, string>,
  sourceGroupId: string | null,
): DrawSource | null {
  if (kind === 'bye') return { kind: 'bye' };
  if (kind === 'groupRank' && sourceGroupId !== null) {
    return {
      kind: 'groupRank',
      group: groupNameById.get(sourceGroupId) ?? 'Group',
      rank: sourceRank ?? 1,
    };
  }
  if ((kind === 'winnerOf' || kind === 'loserOf') && sourceMatchId !== null) {
    return {
      kind,
      round: roundNameByMatchId.get(sourceMatchId) ?? null,
      slot: slotByMatchId.get(sourceMatchId) ?? null,
    };
  }
  return null;
}

/**
 * The public draw. Drafts are invisible.
 */
export async function loadDraw(
  tournamentSlug: string,
  categorySlug: string,
  discipline: 'singles' | 'doubles',
  division: 'open' | 'mens' | 'womens' = 'open',
): Promise<DrawView | null> {
  return loadDrawRow(tournamentSlug, categorySlug, discipline, division, false);
}

/**
 * The same draw, drafts included — for pages behind `requireUser`.
 *
 * Two named entry points rather than a boolean on one, matching
 * `listTournaments` / `listTournamentsForAdmin`. That pair exists because the
 * admin panel once called the public query and an organizer's unpublished
 * tournament became unreachable in their own admin (CLAUDE.md, "Things that
 * bite"). The printable draw sheet is wanted most BEFORE a draw is published,
 * so getting this wrong here would be the same bug with a worse symptom:
 * blank paper.
 */
export async function loadDrawForAdmin(
  tournamentSlug: string,
  categorySlug: string,
  discipline: 'singles' | 'doubles',
  division: 'open' | 'mens' | 'womens' = 'open',
): Promise<DrawView | null> {
  return loadDrawRow(tournamentSlug, categorySlug, discipline, division, true);
}

async function loadDrawRow(
  tournamentSlug: string,
  categorySlug: string,
  discipline: 'singles' | 'doubles',
  division: 'open' | 'mens' | 'womens',
  includeDrafts: boolean,
): Promise<DrawView | null> {
  const organizationId = orgId();

  const found = await db()
    .select({
      tournamentId: schema.tournaments.id,
      tournamentName: schema.tournaments.name,
      tournamentSlug: schema.tournaments.slug,
      venue: schema.tournaments.venue,
      visibility: schema.tournaments.visibility,
      tournamentStatus: schema.tournaments.status,
      matchMinutes: schema.tournaments.matchMinutes,
      minRestMinutes: schema.tournaments.minRestMinutes,
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
  if (head === undefined) return null;
  if (head.visibility === 'draft' && !includeDrafts) return null;

  /*
   * Every stage, not just the first. An event with a consolation draw has
   * two: the main bracket and the second one hanging off it. Taking only
   * `limit(1)` was correct while a single-elimination event could have
   * exactly one stage, and is exactly how a consolation draw would become
   * invisible after being generated.
   */
  const stageRows = await db()
    .select({
      id: schema.stages.id,
      kind: schema.stages.kind,
      config: schema.stages.config,
      name: schema.stages.name,
    })
    .from(schema.stages)
    .where(eq(schema.stages.eventId, head.eventId))
    .orderBy(asc(schema.stages.sortOrder));

  const stageRow = stageRows.find((st) => st.kind !== 'consolation') ?? stageRows[0];
  const consolationRow = stageRows.find((st) => st.kind === 'consolation');

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
      status: head.tournamentStatus,
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
    return { ...base, stage: null, rounds: [], groups: [], consolation: null };
  }

  const config = stageRow.config as StageSummaryConfig | null;

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
      stageId: schema.rounds.stageId,
    })
    .from(schema.rounds)
    .where(
      inArray(
        schema.rounds.stageId,
        consolationRow === undefined ? [stageRow.id] : [stageRow.id, consolationRow.id],
      ),
    )
    .orderBy(asc(schema.rounds.roundIndex));

  if (roundRows.length === 0) {
    return {
      ...base,
      stage: {
        id: stageRow.id,
        kind: stageRow.kind,
        description: config?.description ?? null,
        summary: config ?? {},
      },
      rounds: [],
      groups: groupRows,
      consolation: null,
    };
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
      scheduledAt: schema.matches.scheduledAt,
      completedAt: schema.matches.completedAt,
      courtName: schema.courts.name,
    })
    .from(schema.matches)
    .leftJoin(schema.courts, eq(schema.courts.id, schema.matches.courtId))
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

  const groupIdByRound = new Map(roundRows.map((round) => [round.id, round.groupId]));
  const display = reconcileScheduleDisplay(
    matchRows.map((match) => ({
      ...match,
      eventId: head.eventId,
      groupId: groupIdByRound.get(match.roundId) ?? null,
    })),
    sideRows.map((side) => ({ ...side, id: `${side.matchId}:${side.position}` })),
    new Map([
      [
        head.eventId,
        { matchMinutes: head.matchMinutes, minRestMinutes: head.minRestMinutes },
      ],
    ]),
  );
  const presentedMatchRows = matchRows.map((match) => ({
    ...match,
    ...display.matches.get(match.id),
  }));
  const presentedSideRows = sideRows.map((side) => ({
    ...side,
    entrantId:
      display.sides.find((candidate) => candidate.id === `${side.matchId}:${side.position}`)
        ?.entrantId ?? null,
  }));

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
  for (const s of presentedSideRows) {
    const list = sidesByMatch.get(s.matchId) ?? [];
    list.push({
      position: s.position,
      entrantId: s.entrantId,
      name: s.entrantId === null ? null : (nameBy.get(s.entrantId) ?? null),
      seed: s.entrantId === null ? null : (seedBy.get(s.entrantId) ?? null),
      source: sourceFor(
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
  for (const m of presentedMatchRows) {
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

  const allRounds = roundRows.map((r) => ({
    stageId: r.stageId,
    round: {
      id: r.id,
      name: r.name,
      roundIndex: r.roundIndex,
      kind: r.kind,
      groupId: r.groupId,
      matches: (matchesByRound.get(r.id) ?? []).sort((a, b) => a.slotIndex - b.slotIndex),
    } satisfies DrawRound,
  }));

  // Split by stage. The two brackets are drawn separately — the
  // consolation one is not a continuation of the main chain and a renderer
  // handed both at once would try to connect them.
  const rounds: DrawRound[] = allRounds
    .filter((r) => r.stageId === stageRow.id)
    .map((r) => r.round);

  const consolationRounds: DrawRound[] =
    consolationRow === undefined
      ? []
      : allRounds.filter((r) => r.stageId === consolationRow.id).map((r) => r.round);

  const consolationConfig = consolationRow?.config as { description?: string } | null | undefined;

  /*
   * Every feeder contributes exactly one `loserOf` side, and only the
   * consolation's first round has them, so counting those sides is the
   * field size without a second query. The main draw's entrant count is
   * the wrong number here — an 8-draw feeds a 4-player consolation.
   */
  const consolationRoundIds = new Set(
    allRounds.filter((r) => r.stageId === consolationRow?.id).map((r) => r.round.id),
  );
  const consolationMatchIds = new Set(
    matchRows.filter((m) => consolationRoundIds.has(m.roundId)).map((m) => m.id),
  );
  const consolationFeeders = sideRows.filter(
    (s) => s.sourceKind === 'loserOf' && consolationMatchIds.has(s.matchId),
  ).length;

  return {
    ...base,
    stage: {
      id: stageRow.id,
      kind: stageRow.kind,
      description: config?.description ?? null,
      summary: config ?? {},
    },
    rounds,
    groups: groupRows,
    consolation:
      consolationRow === undefined || consolationRounds.length === 0
        ? null
        : {
            id: consolationRow.id,
            name: consolationRow.name ?? 'Consolation',
            description: consolationConfig?.description ?? null,
            rounds: consolationRounds,
            feederCount: consolationFeeders,
          },
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

  /*
   * Within a category the database returns no guaranteed order, so C+ Doubles
   * could appear above C+ Singles on one request and below it on the next.
   * That matters more than it looks: /t/:slug now redirects to draws[0], so
   * an unstable order means the same printed QR code lands on a different
   * draw from one scan to the next. Singles first, then open before gendered
   * divisions — the order a draw sheet is read in.
   */
  const DISCIPLINE_ORDER = { singles: 0, doubles: 1 } as const;
  const DIVISION_ORDER = { open: 0, mens: 1, womens: 2 } as const;
  rows.sort(
    (a, b) =>
      a.rank - b.rank ||
      (DISCIPLINE_ORDER[a.discipline] ?? 9) - (DISCIPLINE_ORDER[b.discipline] ?? 9) ||
      (DIVISION_ORDER[a.division] ?? 9) - (DIVISION_ORDER[b.division] ?? 9),
  );

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

/* ------------------------------------------------------------------------ */
/* OT-17 — the tournament overview                                          */
/* ------------------------------------------------------------------------ */

export interface OverviewCell {
  readonly categoryCode: string;
  readonly categorySlug: string;
  readonly categoryRank: number;
  readonly discipline: string;
  readonly division: string;
  readonly format: string;
  readonly entrantCount: number;
  readonly matchCount: number;
  /** As stored: 'draft' | 'published' | 'inProgress' | 'complete' | 'notRun'. */
  readonly status: string;
}

/**
 * Every event of a tournament, including the ones there is nothing to show
 * for yet.
 *
 * Deliberately NOT `drawPreviews`, which filters to published, in-progress
 * and complete events. That filter is right for a home-page card — it lists
 * draws you can click — and wrong for an overview, whose job includes
 * saying why a category you expected is not there. A grid built on
 * `drawPreviews` silently omits a category marked "not held" and a
 * published category whose draw has not been generated, which are the two
 * cases OT-17 says must explain themselves.
 *
 * Draft events are still excluded: an organizer's unpublished work is not
 * public, same rule as the rest of this file.
 */
export async function tournamentOverview(tournamentId: string): Promise<OverviewCell[]> {
  const rows = await db()
    .select({
      eventId: schema.events.id,
      categoryCode: schema.categories.code,
      categorySlug: schema.categories.slug,
      categoryRank: schema.categories.rank,
      discipline: schema.events.discipline,
      division: schema.events.division,
      format: schema.events.format,
      status: schema.events.status,
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
        inArray(schema.events.status, ['published', 'inProgress', 'complete', 'notRun']),
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
      schema.events.status,
    );

  /*
   * Match counts tell "published" apart from "generated", which the event
   * status does not: an event sits at 'published' both before and after its
   * bracket exists. Byes are excluded — a bye is not a match anyone plays,
   * and counting them would call an ungenerated draw generated in the one
   * case where every first-round slot happened to be a bye.
   */
  const played = await db()
    .select({ eventId: schema.matches.eventId, n: count(schema.matches.id) })
    .from(schema.matches)
    .where(and(eq(schema.matches.tournamentId, tournamentId), ne(schema.matches.status, 'bye')))
    .groupBy(schema.matches.eventId);
  const matchesBy = new Map(played.map((r) => [r.eventId, r.n]));

  const DISCIPLINE_ORDER = { singles: 0, doubles: 1 } as const;
  const DIVISION_ORDER = { open: 0, mens: 1, womens: 2 } as const;

  return rows
    .map((r) => ({
      categoryCode: r.categoryCode,
      categorySlug: r.categorySlug,
      categoryRank: r.categoryRank,
      discipline: r.discipline,
      division: r.division,
      format: r.format,
      entrantCount: r.entrantCount,
      matchCount: matchesBy.get(r.eventId) ?? 0,
      status: r.status,
    }))
    .sort(
      (a, b) =>
        a.categoryRank - b.categoryRank ||
        (DISCIPLINE_ORDER[a.discipline as 'singles' | 'doubles'] ?? 9) -
          (DISCIPLINE_ORDER[b.discipline as 'singles' | 'doubles'] ?? 9) ||
        (DIVISION_ORDER[a.division as 'open' | 'mens' | 'womens'] ?? 9) -
          (DIVISION_ORDER[b.division as 'open' | 'mens' | 'womens'] ?? 9),
    );
}

/* ------------------------------------------------------------------------ */
/* Updates and media                                                        */
/* ------------------------------------------------------------------------ */

export interface UpdateSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly body: string;
  readonly coverUrl: string | null;
  readonly coverAlt: string | null;
  readonly publishedAt: Date | null;
  readonly tournamentSlug: string | null;
  readonly tournamentName: string | null;
  readonly mediaCount: number;
}

export interface MediaItem {
  readonly id: string;
  readonly url: string;
  readonly alt: string;
  readonly caption: string | null;
  readonly updateSlug: string;
  readonly updateTitle: string;
  readonly publishedAt: Date | null;
}

/**
 * Published updates, newest first.
 *
 * `publishedAt` rather than `createdAt` orders them: a post drafted three
 * weeks early must not sort as three weeks old the moment it goes live.
 */
export async function listUpdates(limit?: number): Promise<UpdateSummary[]> {
  const rows = await db()
    .select({
      id: schema.updates.id,
      slug: schema.updates.slug,
      title: schema.updates.title,
      excerpt: schema.updates.excerpt,
      body: schema.updates.body,
      coverUrl: schema.updates.coverUrl,
      coverAlt: schema.updates.coverAlt,
      publishedAt: schema.updates.publishedAt,
      tournamentSlug: schema.tournaments.slug,
      tournamentName: schema.tournaments.name,
      mediaCount: count(schema.mediaItems.id),
    })
    .from(schema.updates)
    .leftJoin(schema.tournaments, eq(schema.tournaments.id, schema.updates.tournamentId))
    .leftJoin(schema.mediaItems, eq(schema.mediaItems.updateId, schema.updates.id))
    .where(
      and(
        eq(schema.updates.organizationId, orgId()),
        inArray(schema.updates.visibility, ['public', 'unlisted']),
        isNotNull(schema.updates.publishedAt),
      ),
    )
    .groupBy(
      schema.updates.id,
      schema.tournaments.slug,
      schema.tournaments.name,
    )
    .orderBy(desc(schema.updates.publishedAt))
    .limit(limit ?? 100);

  return rows;
}

export async function updateBySlug(
  slug: string,
): Promise<(UpdateSummary & { readonly media: readonly MediaItem[] }) | null> {
  const rows = await db()
    .select({
      id: schema.updates.id,
      slug: schema.updates.slug,
      title: schema.updates.title,
      excerpt: schema.updates.excerpt,
      body: schema.updates.body,
      coverUrl: schema.updates.coverUrl,
      coverAlt: schema.updates.coverAlt,
      publishedAt: schema.updates.publishedAt,
      tournamentSlug: schema.tournaments.slug,
      tournamentName: schema.tournaments.name,
    })
    .from(schema.updates)
    .leftJoin(schema.tournaments, eq(schema.tournaments.id, schema.updates.tournamentId))
    .where(
      and(
        eq(schema.updates.organizationId, orgId()),
        eq(schema.updates.slug, slug),
        inArray(schema.updates.visibility, ['public', 'unlisted']),
        isNotNull(schema.updates.publishedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (row === undefined) return null;

  const media = await db()
    .select({
      id: schema.mediaItems.id,
      url: schema.mediaItems.url,
      alt: schema.mediaItems.alt,
      caption: schema.mediaItems.caption,
    })
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.updateId, row.id))
    .orderBy(asc(schema.mediaItems.position), asc(schema.mediaItems.createdAt));

  return {
    ...row,
    mediaCount: media.length,
    media: media.map((m) => ({
      ...m,
      updateSlug: row.slug,
      updateTitle: row.title,
      publishedAt: row.publishedAt,
    })),
  };
}

export async function publicTournamentPaths(slugs: readonly string[]): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const tournaments = await db()
    .select({
      id: schema.tournaments.id,
      slug: schema.tournaments.slug,
      visibility: schema.tournaments.visibility,
      entriesOpen: schema.tournaments.entriesOpen,
    })
    .from(schema.tournaments)
    .where(
      and(
        eq(schema.tournaments.organizationId, orgId()),
        inArray(schema.tournaments.slug, [...slugs]),
      ),
    );
  const paths = new Set<string>();
  const publicTournaments = tournaments.filter(
    (tournament) => tournament.visibility === 'public' || tournament.visibility === 'unlisted',
  );
  for (const tournament of publicTournaments) paths.add(`/t/${tournament.slug}`);
  for (const tournament of tournaments) {
    if (tournament.entriesOpen) paths.add(`/t/${tournament.slug}/enter`);
  }

  if (publicTournaments.length === 0) return paths;
  const events = await db()
    .select({
      id: schema.events.id,
      tournamentId: schema.events.tournamentId,
      tournamentSlug: schema.tournaments.slug,
      categorySlug: schema.categories.slug,
      discipline: schema.events.discipline,
      division: schema.events.division,
    })
    .from(schema.events)
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(
      and(
        inArray(schema.events.tournamentId, publicTournaments.map((tournament) => tournament.id)),
        inArray(schema.events.status, ['published', 'inProgress', 'complete']),
      ),
    );
  const eventIds = events.map((event) => event.id);
  const matches =
    eventIds.length === 0
      ? []
      : await db()
          .select({ id: schema.matches.id, eventId: schema.matches.eventId })
          .from(schema.matches)
          .where(inArray(schema.matches.eventId, eventIds));
  const matchIdsByEvent = new Map<string, string[]>();
  for (const match of matches) {
    matchIdsByEvent.set(match.eventId, [...(matchIdsByEvent.get(match.eventId) ?? []), match.id]);
  }

  for (const event of events) {
    const base = `/t/${event.tournamentSlug}/${event.categorySlug}/${drawSegment(
      event.division as Division,
      event.discipline as Discipline,
    )}`;
    paths.add(base);
    paths.add(`${base}/path`);
    for (const matchId of matchIdsByEvent.get(event.id) ?? []) {
      paths.add(`${base}/m/${matchId}`);
    }
  }
  return paths;
}

/**
 * Every photo the club has published, newest first.
 *
 * The media page is this list -- the same rows the updates page reads, along
 * a different axis. A separate gallery table would mean finals-day photos
 * exist twice and the captions drift.
 */
export async function listMedia(limit = 120): Promise<MediaItem[]> {
  return db()
    .select({
      id: schema.mediaItems.id,
      url: schema.mediaItems.url,
      alt: schema.mediaItems.alt,
      caption: schema.mediaItems.caption,
      updateSlug: schema.updates.slug,
      updateTitle: schema.updates.title,
      publishedAt: schema.updates.publishedAt,
    })
    .from(schema.mediaItems)
    .innerJoin(schema.updates, eq(schema.updates.id, schema.mediaItems.updateId))
    .where(
      and(
        eq(schema.mediaItems.organizationId, orgId()),
        inArray(schema.updates.visibility, ['public', 'unlisted']),
        isNotNull(schema.updates.publishedAt),
      ),
    )
    .orderBy(desc(schema.updates.publishedAt), asc(schema.mediaItems.position))
    .limit(limit);
}
