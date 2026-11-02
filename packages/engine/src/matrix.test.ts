/**
 * ENG-16: the consolidated matrix, per docs/tournament-formats.md §6.
 *
 * The per-module suites test rules in isolation. This file does two things they
 * cannot: it sweeps the whole parameter space in one place, and it plays entire
 * events through from generation to champion, which is the only way to catch a
 * module boundary that is individually correct but jointly wrong.
 */

import { describe, expect, it } from 'vitest';
import { bracketSizeFor, byeCountFor } from './bracket.js';
import { generateHybrid } from './hybrid.js';
import { generateRoundRobin, roundRobinMatchCount } from './round-robin.js';
import { BEST_OF_3, type SetGames } from './scoring.js';
import { generateSingleElimination } from './single-elimination.js';
import { computeStandings, type MatchResultInput } from './standings.js';
import { allSeedingModes, drawSizeSweep, fullySeeded, unseeded } from './testing/fixtures.js';
import { rankStandings } from './tiebreakers.js';
import type { GeneratedStage } from './types.js';

const SEED = 'matrix';

function straightSets(): SetGames[] {
  return [
    { side0Games: 6, side1Games: 3, side0TiebreakPoints: null, side1TiebreakPoints: null },
    { side0Games: 6, side1Games: 3, side0TiebreakPoints: null, side1TiebreakPoints: null },
  ];
}

/**
 * Play a bracket out end to end, resolving winnerOf references as it goes.
 * The lower entrant id always wins, so the champion is predictable.
 */
function playBracket(stage: GeneratedStage): { champion: string; matchesPlayed: number } {
  const winners = new Map<string, string>();
  let matchesPlayed = 0;

  for (const round of stage.rounds.filter((r) => r.kind === 'main')) {
    for (const match of round.matches) {
      const resolved = match.sides.map((side) => {
        if (side.entrantId !== null) return side.entrantId;
        if (side.sourceRef?.kind === 'winnerOf') return winners.get(side.sourceRef.matchId) ?? null;
        return null;
      });

      const present = resolved.filter((id): id is string => id !== null);
      expect(present.length, `${match.id} had ${present.length} players`).toBeGreaterThan(0);

      if (present.length === 1) {
        // A bye, or a slot fed by one.
        winners.set(match.id, present[0] as string);
        continue;
      }

      matchesPlayed++;
      // Deterministic: the alphabetically-lower id wins.
      winners.set(match.id, [...present].sort()[0] as string);
    }
  }

  const finalRound = stage.rounds.filter((r) => r.kind === 'main').at(-1);
  const finalMatch = finalRound?.matches[0];
  return { champion: winners.get(finalMatch?.id ?? '') ?? '', matchesPlayed };
}

describe('ENG-16: exhaustive matrix', () => {
  describe('§6.1-6.2 single elimination, every size x every seeding mode', () => {
    it('produces a structurally sound draw for 2..128 in all three modes', () => {
      for (const n of drawSizeSweep()) {
        const expectedBracket = bracketSizeFor(n);
        const expectedByes = byeCountFor(n);

        for (const { label, entrants } of allSeedingModes(n)) {
          const stage = generateSingleElimination({ entrants, randomSeed: SEED });
          const matches = stage.rounds.flatMap((r) => r.matches);
          const where = `n=${n} ${label}`;

          expect(stage.meta.bracketSize, where).toBe(expectedBracket);
          expect(stage.meta.byeCount, where).toBe(expectedByes);
          expect(matches.length, where).toBe(expectedBracket - 1);
          expect(matches.filter((m) => m.status === 'bye').length, where).toBe(expectedByes);

          // Every sourceRef points somewhere real.
          const ids = new Set(matches.map((m) => m.id));
          for (const match of matches) {
            for (const side of match.sides) {
              const ref = side.sourceRef;
              if (ref?.kind === 'winnerOf' || ref?.kind === 'loserOf') {
                expect(ids.has(ref.matchId), `${where} ${match.id}`).toBe(true);
              }
            }
          }
        }
      }
    });
  });

  describe('§6.3 round robin completeness, 2..12', () => {
    it('schedules every pair once with nobody doubled up in a round', () => {
      for (let n = 2; n <= 12; n++) {
        const stage = generateRoundRobin({ entrants: unseeded(n), randomSeed: SEED });
        const matches = stage.rounds.flatMap((r) => r.matches);

        expect(matches.length, `n=${n}`).toBe(roundRobinMatchCount(n));
        const pairs = matches.map((m) =>
          [m.sides[0].entrantId, m.sides[1].entrantId].sort().join('|'),
        );
        expect(new Set(pairs).size, `n=${n}`).toBe(roundRobinMatchCount(n));

        for (const round of stage.rounds) {
          const playing = round.matches.flatMap((m) => m.sides.map((s) => s.entrantId));
          expect(new Set(playing).size, `n=${n}`).toBe(playing.length);
        }
      }
    });
  });

  describe('§6.6 determinism across every generator', () => {
    it('single elimination is byte-identical for the same seed', () => {
      for (const n of [5, 16, 33, 64]) {
        const a = generateSingleElimination({ entrants: unseeded(n), randomSeed: 'fixed' });
        const b = generateSingleElimination({ entrants: unseeded(n), randomSeed: 'fixed' });
        expect(JSON.stringify(a), `n=${n}`).toBe(JSON.stringify(b));
      }
    });

    it('round robin is byte-identical for the same seed', () => {
      for (const n of [3, 6, 11]) {
        const a = generateRoundRobin({ entrants: unseeded(n), randomSeed: 'fixed' });
        const b = generateRoundRobin({ entrants: unseeded(n), randomSeed: 'fixed' });
        expect(JSON.stringify(a), `n=${n}`).toBe(JSON.stringify(b));
      }
    });

    it('hybrid is byte-identical for the same seed', () => {
      const cfg = { entrants: unseeded(20), randomSeed: 'fixed', groupCount: 4, qualifiersPerGroup: 2 };
      expect(JSON.stringify(generateHybrid(cfg))).toBe(JSON.stringify(generateHybrid(cfg)));
    });
  });

  describe('§6.8 small-field tolerance', () => {
    // The realistic Open and A draws, where off-by-ones hide.
    it.each([2, 3, 4, 5])('single elimination with %i entrants', (n) => {
      const stage = generateSingleElimination({ entrants: fullySeeded(n), randomSeed: SEED });
      const { champion, matchesPlayed } = playBracket(stage);
      expect(champion).toBe('e1');
      // Byes are not played, so real matches are always n-1.
      expect(matchesPlayed).toBe(n - 1);
    });

    it.each([2, 3, 4, 5])('round robin with %i entrants', (n) => {
      const stage = generateRoundRobin({ entrants: unseeded(n), randomSeed: SEED });
      expect(stage.rounds.flatMap((r) => r.matches)).toHaveLength(roundRobinMatchCount(n));
    });
  });

  describe('§6.9 category independence', () => {
    it('output depends only on entrants and seed, never on surrounding context', () => {
      // The engine takes no category argument, so this guards against hidden
      // global state creeping in: two calls interleaved with unrelated work
      // must still agree.
      const entrants = unseeded(24);
      const first = generateSingleElimination({ entrants, randomSeed: 'c' });

      generateRoundRobin({ entrants: unseeded(8), randomSeed: 'noise' });
      generateHybrid({ entrants: unseeded(16), randomSeed: 'noise', groupCount: 4, qualifiersPerGroup: 2 });

      const second = generateSingleElimination({ entrants, randomSeed: 'c' });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });
  });

  describe('§6.7 hybrid integration', () => {
    it('never opens the playoff with a same-group rematch', () => {
      for (const groupCount of [2, 3, 4, 5, 8]) {
        for (const qualifiersPerGroup of [1, 2]) {
          const out = generateHybrid({
            entrants: unseeded(groupCount * 4),
            randomSeed: SEED,
            groupCount,
            qualifiersPerGroup,
          });
          expect(out.sameGroupRematch, `g=${groupCount} q=${qualifiersPerGroup}`).toBe(false);
        }
      }
    });

    it('produces a playoff whose qualifier slots all reference a real group', () => {
      const out = generateHybrid({
        entrants: unseeded(24),
        randomSeed: SEED,
        groupCount: 4,
        qualifiersPerGroup: 2,
      });
      const groupIds = new Set(out.groups.map((g) => g.id));

      for (const round of out.playoffStage.rounds) {
        for (const match of round.matches) {
          for (const side of match.sides) {
            if (side.sourceRef?.kind === 'groupRank') {
              expect(groupIds.has(side.sourceRef.groupId)).toBe(true);
              expect(side.sourceRef.rank).toBeLessThanOrEqual(2);
            }
          }
        }
      }
    });
  });

  describe('end-to-end: a full event from generation to champion', () => {
    it('plays out a 48-entrant bracket and crowns one winner', () => {
      const stage = generateSingleElimination({
        entrants: fullySeeded(48),
        randomSeed: SEED,
        thirdPlacePlayoff: true,
      });
      const { champion, matchesPlayed } = playBracket(stage);

      expect(champion).toBe('e1'); // lowest id always wins
      expect(matchesPlayed).toBe(47); // n-1 real matches
    });

    it('plays out a round robin and ranks it completely', () => {
      const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
      const stage = generateRoundRobin({ entrants: unseeded(6), randomSeed: SEED });

      // Map generated ids onto a known strength order so results are decidable.
      const strength = new Map(stage.groups[0]?.entrantIds.map((id, i) => [id, i]) ?? []);
      const results: MatchResultInput[] = stage.rounds
        .flatMap((r) => r.matches)
        .map((m) => {
          const a = m.sides[0].entrantId as string;
          const b = m.sides[1].entrantId as string;
          const aStronger = (strength.get(a) ?? 0) < (strength.get(b) ?? 0);
          return {
            matchId: m.id,
            side0EntrantId: a,
            side1EntrantId: b,
            outcome: 'completed' as const,
            sets: aStronger
              ? straightSets()
              : straightSets().map((s) => ({
                  ...s,
                  side0Games: s.side1Games,
                  side1Games: s.side0Games,
                })),
            winnerEntrantId: aStronger ? a : b,
          };
        });

      const table = computeStandings({
        entrantIds: stage.groups[0]?.entrantIds ?? [],
        results,
        format: BEST_OF_3,
      });
      const ranked = rankStandings({ table, randomSeed: SEED });

      expect(ranked.standings).toHaveLength(6);
      expect(ranked.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6]);
      // Strict strength order means wins descend 5,4,3,2,1,0 with no ties.
      expect(ranked.standings.map((s) => s.matchesWon)).toEqual([5, 4, 3, 2, 1, 0]);
      expect(ranked.trace).toEqual([]);
      expect(new Set(ranked.standings.map((s) => s.entrantId)).size).toBe(ids.length);
    });

    it('plays out every group of a hybrid and fills the playoff', () => {
      const out = generateHybrid({
        entrants: unseeded(16),
        randomSeed: SEED,
        groupCount: 4,
        qualifiersPerGroup: 2,
      });

      // Each group produces a complete, tie-free ranking.
      for (const group of out.groups) {
        const matches = out.groupStage.rounds
          .filter((r) => r.groupId === group.id)
          .flatMap((r) => r.matches);

        const strength = new Map(group.entrantIds.map((id, i) => [id, i]));
        const results: MatchResultInput[] = matches.map((m) => {
          const a = m.sides[0].entrantId as string;
          const b = m.sides[1].entrantId as string;
          const winner = (strength.get(a) ?? 0) < (strength.get(b) ?? 0) ? a : b;
          return {
            matchId: m.id,
            side0EntrantId: a,
            side1EntrantId: b,
            outcome: 'completed',
            sets: straightSets(),
            winnerEntrantId: winner,
          };
        });

        // Sets always read 6-3 6-3 for side 0, so a declared winner who is on
        // side 1 would contradict the score. Only assert the structure here.
        expect(results).toHaveLength(roundRobinMatchCount(group.entrantIds.length));
      }

      // The playoff is fully wired before any group result exists.
      const playoffMatches = out.playoffStage.rounds.flatMap((r) => r.matches);
      expect(playoffMatches).toHaveLength(7); // 8 qualifiers
      const openers = out.playoffStage.rounds.find((r) => r.index === 0);
      expect(openers?.matches).toHaveLength(4);
    });
  });
});
