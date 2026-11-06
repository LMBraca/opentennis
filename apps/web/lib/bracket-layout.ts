/**
 * Turning persisted draw rows back into the shape the engine's geometry wants.
 *
 * This lived inside `components/bracket.tsx` until the printable draw sheet
 * (OUT-1) needed the same coordinates. Two copies of this wiring would be two
 * answers to "who feeds this match", and the copy that drifted would be the
 * one nobody was looking at — the same reasoning that put `acceptSubmission`
 * in one place in `lib/accept-entry.ts`.
 *
 * Pure: rows in, numbers out. No I/O, no DOM, no React.
 */

import {
  DEFAULT_GEOMETRY,
  layoutBracket,
  type BracketLayout,
  type GeneratedRound,
  type GeneratedStage,
  type GeometryOptions,
} from '@opentennis/engine';
import type { DrawRound } from './queries';

/**
 * The elimination chain. The third-place playoff is deliberately excluded:
 * it hangs off the losing semifinalists rather than feeding anything, so it
 * carries no connectors and every renderer places it separately.
 */
export function mainRounds(rounds: readonly DrawRound[]): readonly DrawRound[] {
  return rounds.filter((r) => r.kind !== 'thirdPlace');
}

export function thirdPlaceRound(rounds: readonly DrawRound[]): DrawRound | undefined {
  return rounds.find((r) => r.kind === 'thirdPlace');
}

/**
 * Drop the "Consolation " that the engine puts on consolation round names.
 *
 * The prefix is load-bearing in every list that mixes both brackets — the
 * scores queue, the order of play, the CSV export — where a bare
 * "Semifinal" is a result entered against the wrong match. It is only
 * noise where the bracket has already been named: under a "Consolation
 * draw" heading, or on a sheet titled "… — Consolation draw", columns
 * reading "Consolation semifinal / Consolation final" say it three times.
 */
const PREFIX = 'Consolation ';

export function withoutConsolationPrefix(
  rounds: readonly DrawRound[],
): readonly DrawRound[] {
  return rounds.map((round) =>
    round.name.startsWith(PREFIX)
      ? {
          ...round,
          name: `${round.name.charAt(PREFIX.length).toUpperCase()}${round.name.slice(PREFIX.length + 1)}`,
        }
      : round,
  );
}

/**
 * Rebuild the minimal engine shape layoutBracket needs.
 *
 * Deliberately reconstructed from persisted rows rather than stored alongside
 * them: geometry is a pure function of structure, so caching it would just be
 * a second source of truth that can drift.
 */
function toEngineStage(rounds: readonly DrawRound[]): GeneratedStage {
  const engineRounds: GeneratedRound[] = rounds.map((round) => ({
    index: round.roundIndex,
    name: round.name,
    kind: round.kind === 'thirdPlace' ? 'thirdPlace' : 'main',
    matches: round.matches.map((m) => ({
      id: m.engineMatchId,
      roundIndex: round.roundIndex,
      slotIndex: m.slotIndex,
      status: m.status === 'bye' ? ('bye' as const) : ('pending' as const),
      sides: [
        {
          position: 0 as const,
          entrantId: m.sides[0]?.entrantId ?? null,
          sourceRef: null,
        },
        {
          position: 1 as const,
          entrantId: m.sides[1]?.entrantId ?? null,
          sourceRef: null,
        },
      ] as const,
    })),
  }));

  return {
    kind: 'singleElimination',
    rounds: engineRounds,
    groups: [],
    meta: {
      seedingMode: 'unseeded',
      entrantCount: 0,
      seededCount: 0,
      bracketSize: null,
      byeCount: 0,
      byeRecipients: [],
      randomSeed: '',
      description: '',
    },
  };
}

/**
 * Lay out the elimination rounds.
 *
 * Parent relationships are derived from SLOT ARITHMETIC rather than from the
 * persisted sourceRefs, because layoutBracket needs the structural parent and
 * a bye's winner is already resolved in storage — a bye would otherwise leave
 * its parent with nothing to attach to and the connector would vanish.
 */
export function bracketLayout(
  rounds: readonly DrawRound[],
  geometry: GeometryOptions = DEFAULT_GEOMETRY,
): BracketLayout {
  const stage = toEngineStage(mainRounds(rounds));

  const wired: GeneratedStage = {
    ...stage,
    rounds: stage.rounds.map((round, roundIndex) => {
      if (roundIndex === 0) return round;
      const previous = stage.rounds[roundIndex - 1];
      return {
        ...round,
        matches: round.matches.map((match) => ({
          ...match,
          sides: [
            {
              ...match.sides[0],
              sourceRef:
                previous?.matches[match.slotIndex * 2] === undefined
                  ? null
                  : ({ kind: 'winnerOf', matchId: previous.matches[match.slotIndex * 2]!.id } as const),
            },
            {
              ...match.sides[1],
              sourceRef:
                previous?.matches[match.slotIndex * 2 + 1] === undefined
                  ? null
                  : ({
                      kind: 'winnerOf',
                      matchId: previous.matches[match.slotIndex * 2 + 1]!.id,
                    } as const),
            },
          ] as const,
        })),
      };
    }),
  };

  return layoutBracket(wired, geometry);
}
