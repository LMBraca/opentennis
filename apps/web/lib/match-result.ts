/**
 * Turning what an organizer typed into a decided match.
 *
 * This is the seam between a form and the engine, and it is deliberately
 * pure: no database, no request, so the rules can be tested directly. The
 * server action does I/O and calls this to decide what the result actually
 * is.
 *
 * The engine already knows what a completed set looks like under every
 * format the product supports. Nothing here re-implements that — this file
 * parses, then asks.
 */

import {
  summariseMatch,
  type MatchScoreSummary,
  type ScoringFormat,
  type SetGames,
} from '@opentennis/engine';

/** The non-standard ways a match can end. `completed` means it was played out. */
export type Outcome = 'completed' | 'retirement' | 'walkover' | 'default';

export const OUTCOMES: readonly Outcome[] = [
  'completed',
  'retirement',
  'walkover',
  'default',
];

export function isOutcome(value: string): value is Outcome {
  return (OUTCOMES as readonly string[]).includes(value);
}

/**
 * The scoring format for an event, as stored.
 *
 * `events` holds these flat rather than as a preset name, so a club can set
 * "best of 3, match tiebreak in the third" on one cell and a pro set on
 * another. The columns line up 1:1 with the engine's ScoringFormat.
 */
export interface EventScoringRow {
  readonly setsToWin: number;
  readonly gamesPerSet: number;
  readonly tiebreakAt: number | null;
  readonly tiebreakTo: number;
  readonly decidingSetMode: string;
  readonly adScoring: boolean;
}

export function scoringFormatFor(event: EventScoringRow): ScoringFormat {
  return {
    setsToWin: event.setsToWin,
    gamesPerSet: event.gamesPerSet,
    tiebreakAt: event.tiebreakAt,
    tiebreakTo: event.tiebreakTo,
    // The column is text, so anything that is not the one known alternative
    // is treated as standard rather than crashing a courtside save.
    decidingSetMode: event.decidingSetMode === 'matchTiebreak' ? 'matchTiebreak' : 'standard',
    adScoring: event.adScoring,
  };
}

/** The most sets a format can need, so a form knows how many rows to show. */
export function maxSets(format: ScoringFormat): number {
  return format.setsToWin * 2 - 1;
}

export interface ParsedSet extends SetGames {
  readonly setIndex: number;
}

export interface ParseResult {
  readonly sets: readonly ParsedSet[];
  readonly error?: string;
}

function toInt(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d{1,2}$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

/**
 * Read set rows off a form.
 *
 * A row is "present" when either games box has something in it. Blank rows
 * are skipped, because a best-of-three won in straight sets leaves the third
 * row empty and that is not an error. A row with only ONE side filled IS an
 * error — it means a half-typed score, and silently dropping it would record
 * a different match from the one played.
 */
export function parseSets(
  read: (name: string) => string | null,
  format: ScoringFormat,
): ParseResult {
  const sets: ParsedSet[] = [];

  for (let index = 0; index < maxSets(format); index++) {
    const a = toInt(read(`set${index}_0`));
    const b = toInt(read(`set${index}_1`));

    if (a === null && b === null) continue;
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return { sets: [], error: `Set ${index + 1}: games must be whole numbers.` };
    }
    if (a === null || b === null) {
      return { sets: [], error: `Set ${index + 1}: fill in both games, or leave both blank.` };
    }

    const ta = toInt(read(`tb${index}_0`));
    const tb = toInt(read(`tb${index}_1`));
    if (Number.isNaN(ta) || Number.isNaN(tb)) {
      return { sets: [], error: `Set ${index + 1}: tiebreak points must be whole numbers.` };
    }

    sets.push({
      setIndex: index,
      side0Games: a,
      side1Games: b,
      side0TiebreakPoints: ta,
      side1TiebreakPoints: tb,
    });
  }

  // A gap means a mis-keyed row: you cannot win set 3 without playing set 2.
  for (const [position, set] of sets.entries()) {
    if (set.setIndex !== position) {
      return { sets: [], error: `Set ${position + 1} is blank but a later set is filled in.` };
    }
  }

  return { sets };
}

export interface DecidedResult {
  readonly winner: 0 | 1;
  readonly summary: MatchScoreSummary;
}

/**
 * Decide a match, or explain why it is not decided yet.
 *
 * The rules differ by outcome, and conflating them is how bad data gets in:
 *
 *   completed   — the score itself must decide it. "6-4 3-6" is not a result.
 *   retirement  — someone stopped. A partial score is expected, but somebody
 *                 has to be named as the one who retired, because the score
 *                 alone cannot say who continued.
 *   walkover    — nobody played, so a score is meaningless and is rejected
 *                 rather than quietly stored.
 *   default     — same, but awarded against a player.
 */
export function decide(
  sets: readonly SetGames[],
  format: ScoringFormat,
  outcome: Outcome,
  awardedTo: 0 | 1 | null,
): DecidedResult | { readonly error: string } {
  const summary = summariseMatch(sets, format);

  if (outcome === 'walkover' || outcome === 'default') {
    if (sets.length > 0) {
      return { error: `A ${outcome} has no score. Clear the sets, or pick a different outcome.` };
    }
    if (awardedTo === null) return { error: 'Choose who the match was awarded to.' };
    return { winner: awardedTo, summary };
  }

  if (outcome === 'retirement') {
    if (awardedTo === null) return { error: 'Choose who the match was awarded to.' };
    return { winner: awardedTo, summary };
  }

  if (summary.winner === null) {
    return {
      error:
        summary.hasPartialSet || sets.length === 0
          ? 'That score does not finish the match. Add the remaining sets, or record a retirement.'
          : 'That score does not finish the match.',
    };
  }

  return { winner: summary.winner, summary };
}
