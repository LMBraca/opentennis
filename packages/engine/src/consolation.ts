/**
 * Consolation draws — the second bracket for people knocked out first.
 *
 * Spec: docs/consolation-draws-deferred.md §3a, "first-round-loser
 * consolation", which is the form that form recommends and the only one
 * that is fully pre-renderable.
 *
 * WHY PRE-RENDERABLE MATTERS, since it drives everything here: the field
 * size is `(N − B) / 2` — the number of round-one matches that are not
 * byes — and that is known the moment the main draw is generated, before a
 * ball is hit. So the whole consolation bracket can be built up front with
 * every slot carrying `{ kind: 'loserOf', matchId }`, exactly as the
 * third-place playoff already does. Nothing has to be materialised later
 * as results come in, which keeps the product's rule that a bracket is a
 * complete object the moment it exists.
 *
 * THE COST, worth saying out loud because an organizer will ask: somebody
 * who received a bye and then lost their first match played — in round two
 * — gets NO consolation match. Only round-one losers qualify. The
 * alternative (§3b, first-MATCH losers) is fairer and is not
 * pre-renderable, because the field size then depends on results.
 *
 * A pure function of the main draw's STRUCTURE, never of its results.
 */

import { engineError } from './errors';
import { bracketSizeFor, firstRoundPairs, roundNameFor, seedPositions } from './bracket';
import type {
  GeneratedMatch,
  GeneratedRound,
  GeneratedStage,
  MatchSide,
} from './types';

/**
 * Round names carry the bracket in them: "Consolation semifinal", not
 * "Semifinal".
 *
 * Not cosmetic. Six surfaces render `rounds.name` raw — the scores queue,
 * the order of play, the scorekeeper's token page, the CSV export, the
 * admin draw page and the public bracket — and several of them list
 * matches from BOTH brackets in one flat list. A bare "Semifinal" there is
 * a main-draw semifinal and a consolation semifinal rendered identically,
 * which is a result entered against the wrong match. Naming them apart
 * here fixes all six at once; marking them at each call site would be six
 * chances to miss one.
 *
 * It is also how a draw sheet prints: a consolation bracket's last match
 * is the consolation final, and calling it "the final" would be wrong.
 */
function consolationRoundName(matchesInRound: number): string {
  const base = roundNameFor(matchesInRound);
  return `Consolation ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
}

/** Engine match ids for the consolation bracket. Distinct from the main "r0m0". */
export function consolationMatchIdFor(roundIndex: number, slotIndex: number): string {
  return `c${roundIndex}m${slotIndex}`;
}

export interface ConsolationResult {
  readonly stage: GeneratedStage;
  /** How many first-round losers feed it. Zero means no draw was made. */
  readonly feederCount: number;
}

/**
 * Build the consolation bracket for a generated main draw.
 *
 * Returns null when there is nothing to build: fewer than two first-round
 * losers means nobody to play. A one-player consolation draw is not a
 * kindness, it is a confusing empty bracket.
 */
export function generateConsolation(main: GeneratedStage): ConsolationResult | null {
  if (main.kind !== 'singleElimination') {
    throw engineError(
      'WRONG_STAGE_KIND',
      `Consolation needs a single-elimination main draw, got "${main.kind}"`,
      { kind: main.kind },
    );
  }

  const firstRound = main.rounds.find((r) => r.index === 0 && r.kind === 'main');
  if (firstRound === undefined) return null;

  // Byes produce no loser. This is the whole field.
  const feeders = firstRound.matches.filter((m) => m.status !== 'bye');
  if (feeders.length < 2) return null;

  const bracketSize = bracketSizeFor(feeders.length);
  const byeCount = bracketSize - feeders.length;

  /*
   * Which consolation slots get the byes.
   *
   * seedPositions() gives the standard spread used by the main draw, so
   * byes land apart rather than bunching at the top. There is no seeding
   * to respect here — nobody knows who the losers will be — so this is
   * purely about shape.
   */
  const positions = seedPositions(bracketSize);
  const slots: Array<GeneratedMatch | null> = Array.from({ length: bracketSize }, () => null);
  feeders.forEach((feeder, index) => {
    // seedPositions is ONE-indexed — positions[0] is an unused -1 sentinel,
    // so reading from 0 silently writes the first feeder to slots[-1] and
    // drops them out of the draw.
    const position = positions[index + 1];
    if (position !== undefined && position >= 0) slots[position] = feeder;
  });

  const rounds: GeneratedRound[] = [];

  const firstRoundMatches: GeneratedMatch[] = firstRoundPairs(bracketSize).map(
    ([a, b], slotIndex) => {
      const left = slots[a] ?? null;
      const right = slots[b] ?? null;
      const sideFor = (feeder: GeneratedMatch | null, position: 0 | 1): MatchSide => ({
        position,
        // Unknowable at generation time, by definition: the loser of a
        // match nobody has played.
        entrantId: null,
        sourceRef: feeder === null ? { kind: 'bye' } : { kind: 'loserOf', matchId: feeder.id },
      });

      return {
        id: consolationMatchIdFor(0, slotIndex),
        roundIndex: 0,
        slotIndex,
        sides: [sideFor(left, 0), sideFor(right, 1)] as const,
        /*
         * NOT marked 'bye' even when one side is one.
         *
         * A main-draw bye is resolved at generation: the entrant is known
         * and walks through. Here the surviving side is still "the loser of
         * a match not yet played", so the match cannot be settled now —
         * marking it bye would advance an empty slot and the round after
         * would show a blank name with no way to fill it.
         */
        status: 'pending',
      } satisfies GeneratedMatch;
    },
  );

  rounds.push({
    index: 0,
    name: consolationRoundName(firstRoundMatches.length),
    kind: 'main',
    matches: firstRoundMatches,
  });

  for (let roundIndex = 1; rounds[roundIndex - 1]!.matches.length > 1; roundIndex += 1) {
    const previous = rounds[roundIndex - 1]!;
    const matchCount = previous.matches.length / 2;
    const matches: GeneratedMatch[] = [];

    for (let slotIndex = 0; slotIndex < matchCount; slotIndex += 1) {
      const feederA = previous.matches[slotIndex * 2]!;
      const feederB = previous.matches[slotIndex * 2 + 1]!;
      matches.push({
        id: consolationMatchIdFor(roundIndex, slotIndex),
        roundIndex,
        slotIndex,
        sides: [
          { position: 0, entrantId: null, sourceRef: { kind: 'winnerOf', matchId: feederA.id } },
          { position: 1, entrantId: null, sourceRef: { kind: 'winnerOf', matchId: feederB.id } },
        ] as const,
        status: 'pending',
      });
    }

    rounds.push({
      index: roundIndex,
      name: consolationRoundName(matchCount),
      kind: 'main',
      matches,
    });
  }

  return {
    feederCount: feeders.length,
    stage: {
      kind: 'consolation',
      rounds,
      groups: [],
      meta: {
        seedingMode: 'unseeded',
        entrantCount: feeders.length,
        seededCount: 0,
        bracketSize,
        byeCount,
        byeRecipients: [],
        randomSeed: main.meta.randomSeed,
        description:
          `Consolation draw for the ${feeders.length} first-round ` +
          `${feeders.length === 1 ? 'loser' : 'losers'}. ` +
          'Anyone who received a bye and then lost does not play in it.',
      },
    },
  };
}
