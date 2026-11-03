/**
 * Round robin standings.
 *
 * Spec: docs/tournament-formats.md §3.3 and §5.2.
 *
 * Accumulates per-entrant records from match results, and records the
 * head-to-head matrix that the tiebreaker cascade (ENG-10) needs. Ranking
 * itself lives in tiebreakers.ts — this module only counts.
 */

import { engineError } from './errors';
import { summariseMatch, type SetGames } from './scoring';
import type { EntrantId, GroupId, MatchOutcome, ScoringFormat } from './types';

export interface MatchResultInput {
  readonly matchId: string;
  readonly groupId?: GroupId | undefined;
  readonly side0EntrantId: EntrantId;
  readonly side1EntrantId: EntrantId;
  readonly outcome: MatchOutcome;
  /**
   * Required for walkover, default, and retirement, where the score cannot
   * identify the winner. For a completed match it is optional and, if given,
   * must agree with the sets.
   */
  readonly winnerEntrantId?: EntrantId | null | undefined;
  readonly sets: readonly SetGames[];
}

export interface PointsScheme {
  readonly win: number;
  /** Points for losing a match that was actually played. */
  readonly lossPlayed: number;
  /** Points for losing by walkover or default. */
  readonly lossWalkover: number;
}

/** One point a win, nothing else. Overridable for leagues that score otherwise. */
export const DEFAULT_POINTS: PointsScheme = { win: 1, lossPlayed: 0, lossWalkover: 0 };

export interface EntrantRecord {
  readonly entrantId: EntrantId;
  readonly matchesPlayed: number;
  readonly matchesWon: number;
  readonly matchesLost: number;
  readonly setsWon: number;
  readonly setsLost: number;
  readonly gamesWon: number;
  readonly gamesLost: number;
  readonly points: number;
  /** setsWon / (setsWon + setsLost), or 0 with no sets. */
  readonly setPct: number;
  /** gamesWon / (gamesWon + gamesLost), or 0 with no games. */
  readonly gamePct: number;
}

export interface StandingsTable {
  readonly records: readonly EntrantRecord[];
  /**
   * `${a}|${b}` -> number of times a beat b. A double round robin can produce
   * a 1-1 split, in which case head-to-head does not resolve and the cascade
   * must fall through to percentages.
   */
  readonly headToHeadWins: ReadonlyMap<string, number>;
  /** Results that contributed nothing — unfinished matches. */
  readonly ignoredMatchIds: readonly string[];
}

export interface StandingsConfig {
  readonly entrantIds: readonly EntrantId[];
  readonly results: readonly MatchResultInput[];
  readonly format: ScoringFormat;
  readonly points?: PointsScheme;
}

export function headToHeadKey(a: EntrantId, b: EntrantId): string {
  return `${a}|${b}`;
}

interface Mutable {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
}

function blank(): Mutable {
  return {
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
    points: 0,
  };
}

function pct(won: number, lost: number): number {
  const total = won + lost;
  return total === 0 ? 0 : won / total;
}

/**
 * Walkovers and defaults award the match but contribute no sets and no games.
 *
 * This is not a simplification — counting a walkover as 6-0 6-0 would inflate
 * the set and game percentages that §3.4 uses to break ties, letting someone
 * who never hit a ball outrank someone who won a hard three-setter.
 */
function contributesScore(outcome: MatchOutcome): boolean {
  return outcome === 'completed' || outcome === 'retirement';
}

export function computeStandings(config: StandingsConfig): StandingsTable {
  const { entrantIds, results, format } = config;
  const points = config.points ?? DEFAULT_POINTS;

  const known = new Set(entrantIds);
  const records = new Map<EntrantId, Mutable>(entrantIds.map((id) => [id, blank()]));
  const headToHeadWins = new Map<string, number>();
  const ignoredMatchIds: string[] = [];

  for (const result of results) {
    const { side0EntrantId: a, side1EntrantId: b, matchId, outcome } = result;

    if (!known.has(a) || !known.has(b)) {
      throw engineError('UNKNOWN_ENTRANT', `Match ${matchId} references an entrant not in the group`, {
        matchId,
        side0EntrantId: a,
        side1EntrantId: b,
      });
    }
    if (a === b) {
      throw engineError('INCONSISTENT_RESULT', `Match ${matchId} has the same entrant on both sides`, {
        matchId,
        entrantId: a,
      });
    }

    // An unfinished match is not a result. It contributes nothing at all --
    // not a played match, not a set, not a game.
    if (outcome === 'unfinished') {
      ignoredMatchIds.push(matchId);
      continue;
    }

    const summary = summariseMatch(result.sets, format);
    const declared = result.winnerEntrantId ?? null;

    let winner: EntrantId;
    if (outcome === 'completed') {
      if (summary.winner === null) {
        throw engineError(
          'INCONSISTENT_RESULT',
          `Match ${matchId} is marked completed but the sets do not decide it`,
          { matchId, setsWon: summary.setsWon },
        );
      }
      winner = summary.winner === 0 ? a : b;
      if (declared !== null && declared !== winner) {
        throw engineError(
          'INCONSISTENT_RESULT',
          `Match ${matchId} declares a winner the score contradicts`,
          { matchId, declared, fromScore: winner },
        );
      }
    } else {
      // Retirement, walkover, default: the score cannot name the winner.
      if (declared === null) {
        throw engineError(
          'INCONSISTENT_RESULT',
          `Match ${matchId} has outcome "${outcome}" and needs an explicit winner`,
          { matchId, outcome },
        );
      }
      if (declared !== a && declared !== b) {
        throw engineError(
          'INCONSISTENT_RESULT',
          `Match ${matchId} declares a winner who is not playing in it`,
          { matchId, declared },
        );
      }
      winner = declared;
    }

    const loser = winner === a ? b : a;
    const winnerRecord = records.get(winner) as Mutable;
    const loserRecord = records.get(loser) as Mutable;

    winnerRecord.matchesPlayed++;
    loserRecord.matchesPlayed++;
    winnerRecord.matchesWon++;
    loserRecord.matchesLost++;
    winnerRecord.points += points.win;
    loserRecord.points +=
      outcome === 'walkover' || outcome === 'default' ? points.lossWalkover : points.lossPlayed;

    headToHeadWins.set(
      headToHeadKey(winner, loser),
      (headToHeadWins.get(headToHeadKey(winner, loser)) ?? 0) + 1,
    );

    if (contributesScore(outcome)) {
      const [sets0, sets1] = summary.setsWon;
      const [games0, games1] = summary.gamesWon;
      const recordA = records.get(a) as Mutable;
      const recordB = records.get(b) as Mutable;

      recordA.setsWon += sets0;
      recordA.setsLost += sets1;
      recordB.setsWon += sets1;
      recordB.setsLost += sets0;

      recordA.gamesWon += games0;
      recordA.gamesLost += games1;
      recordB.gamesWon += games1;
      recordB.gamesLost += games0;
    }
  }

  return {
    records: entrantIds.map((entrantId): EntrantRecord => {
      const r = records.get(entrantId) as Mutable;
      return {
        entrantId,
        matchesPlayed: r.matchesPlayed,
        matchesWon: r.matchesWon,
        matchesLost: r.matchesLost,
        setsWon: r.setsWon,
        setsLost: r.setsLost,
        gamesWon: r.gamesWon,
        gamesLost: r.gamesLost,
        points: r.points,
        setPct: pct(r.setsWon, r.setsLost),
        gamePct: pct(r.gamesWon, r.gamesLost),
      };
    }),
    headToHeadWins,
    ignoredMatchIds,
  };
}

/** Net head-to-head between two entrants: >0 means a leads, 0 means unresolved. */
export function headToHead(table: StandingsTable, a: EntrantId, b: EntrantId): number {
  const aWins = table.headToHeadWins.get(headToHeadKey(a, b)) ?? 0;
  const bWins = table.headToHeadWins.get(headToHeadKey(b, a)) ?? 0;
  return aWins - bWins;
}

export function recordFor(table: StandingsTable, entrantId: EntrantId): EntrantRecord {
  const found = table.records.find((r) => r.entrantId === entrantId);
  if (found === undefined) {
    throw engineError('UNKNOWN_ENTRANT', `No record for entrant "${entrantId}"`, { entrantId });
  }
  return found;
}
