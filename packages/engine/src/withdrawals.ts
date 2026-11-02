/**
 * Incomplete round robin: what to do when somebody withdraws mid-group.
 *
 * Spec: docs/tournament-formats.md §3.6.
 *
 * USTA guidance, and the rule this implements:
 *
 *   completed < half of their matches  →  ALL their results are EXPUNGED and
 *                                         they are removed from the standings
 *                                         entirely, as though they never
 *                                         entered.
 *
 *   completed >= half                  →  their completed matches STAND, and
 *                                         each remaining match is recorded as
 *                                         a walkover against them.
 *
 * The threshold exists because a player who quits after one match of five has
 * handed one opponent a free win and distorted the group; a player who quits
 * after four of five has already produced most of the data.
 *
 * This runs as a pre-processing pass over results before computeStandings, and
 * always reports what it did. A silently altered table destroys an organizer's
 * credibility with their members faster than almost anything else.
 */

import { engineError } from './errors.js';
import type { MatchResultInput } from './standings.js';
import type { EntrantId } from './types.js';

export type WithdrawalAction = 'expunged' | 'resultsStand';

export interface WithdrawalAdjustment {
  readonly entrantId: EntrantId;
  readonly action: WithdrawalAction;
  readonly completedMatches: number;
  readonly scheduledMatches: number;
  /** Walkovers created against this entrant. Empty when expunged. */
  readonly walkoversAwarded: readonly EntrantId[];
  /** Human-readable, for the note shown above an adjusted table. */
  readonly reason: string;
}

export interface WithdrawalConfig {
  /** The full original group, including anyone who withdrew. */
  readonly entrantIds: readonly EntrantId[];
  readonly withdrawnEntrantIds: readonly EntrantId[];
  /** Results recorded so far. Unfinished matches do not count as completed. */
  readonly results: readonly MatchResultInput[];
  readonly doubleRoundRobin?: boolean;
}

export interface WithdrawalResult {
  /** Entrants that remain in the standings. */
  readonly entrantIds: readonly EntrantId[];
  /** Results to feed to computeStandings, with walkovers added or rows removed. */
  readonly results: readonly MatchResultInput[];
  readonly adjustments: readonly WithdrawalAdjustment[];
  /** True when anything was changed, so the UI can show a note. */
  readonly adjusted: boolean;
}

function involves(result: MatchResultInput, entrantId: EntrantId): boolean {
  return result.side0EntrantId === entrantId || result.side1EntrantId === entrantId;
}

function opponentOf(result: MatchResultInput, entrantId: EntrantId): EntrantId {
  return result.side0EntrantId === entrantId ? result.side1EntrantId : result.side0EntrantId;
}

/** A result that actually happened. Unfinished matches are not data. */
function isCompleted(result: MatchResultInput): boolean {
  return result.outcome !== 'unfinished';
}

export function applyWithdrawals(config: WithdrawalConfig): WithdrawalResult {
  const { entrantIds, withdrawnEntrantIds, results } = config;
  const perOpponent = config.doubleRoundRobin === true ? 2 : 1;

  const known = new Set(entrantIds);
  for (const id of withdrawnEntrantIds) {
    if (!known.has(id)) {
      throw engineError('UNKNOWN_ENTRANT', `Withdrawn entrant "${id}" is not in the group`, {
        entrantId: id,
      });
    }
  }

  // Scheduled matches per entrant in a complete group.
  const scheduledMatches = (entrantIds.length - 1) * perOpponent;

  const adjustments: WithdrawalAdjustment[] = [];
  const expunged = new Set<EntrantId>();
  const addedWalkovers: MatchResultInput[] = [];

  for (const entrantId of withdrawnEntrantIds) {
    const theirResults = results.filter((r) => involves(r, entrantId) && isCompleted(r));
    const completedMatches = theirResults.length;

    // Strictly fewer than half -> expunge. Exactly half stands, per the rule.
    const underHalf = completedMatches * 2 < scheduledMatches;

    if (underHalf) {
      expunged.add(entrantId);
      adjustments.push({
        entrantId,
        action: 'expunged',
        completedMatches,
        scheduledMatches,
        walkoversAwarded: [],
        reason:
          `Withdrew after ${completedMatches} of ${scheduledMatches} matches — fewer than half, ` +
          `so all results involving this entrant were removed from the standings.`,
      });
      continue;
    }

    // Results stand; every unplayed match becomes a walkover against them.
    const playedAgainst = new Map<EntrantId, number>();
    for (const r of theirResults) {
      const other = opponentOf(r, entrantId);
      playedAgainst.set(other, (playedAgainst.get(other) ?? 0) + 1);
    }

    const walkoversAwarded: EntrantId[] = [];
    for (const other of entrantIds) {
      if (other === entrantId) continue;
      // Do not manufacture a walkover between two withdrawn entrants; whichever
      // of them is processed second would otherwise award one in reverse.
      if (withdrawnEntrantIds.includes(other)) continue;

      const alreadyPlayed = playedAgainst.get(other) ?? 0;
      for (let i = alreadyPlayed; i < perOpponent; i++) {
        walkoversAwarded.push(other);
        addedWalkovers.push({
          matchId: `wo:${entrantId}:${other}:${i}`,
          side0EntrantId: other,
          side1EntrantId: entrantId,
          outcome: 'walkover',
          winnerEntrantId: other,
          sets: [],
        });
      }
    }

    adjustments.push({
      entrantId,
      action: 'resultsStand',
      completedMatches,
      scheduledMatches,
      walkoversAwarded,
      reason:
        `Withdrew after ${completedMatches} of ${scheduledMatches} matches — half or more, ` +
        `so completed results stand and the remaining ${walkoversAwarded.length} ` +
        `${walkoversAwarded.length === 1 ? 'match was' : 'matches were'} recorded as ` +
        `${walkoversAwarded.length === 1 ? 'a walkover' : 'walkovers'}.`,
    });
  }

  const keptResults = results.filter(
    (r) =>
      isCompleted(r) &&
      !expunged.has(r.side0EntrantId) &&
      !expunged.has(r.side1EntrantId),
  );

  return {
    entrantIds: entrantIds.filter((id) => !expunged.has(id)),
    results: [...keptResults, ...addedWalkovers],
    adjustments,
    adjusted: adjustments.length > 0,
  };
}
