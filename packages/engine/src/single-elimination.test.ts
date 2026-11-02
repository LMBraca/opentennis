import { describe, expect, it } from 'vitest';
import { bracketSizeFor, byeCountFor, seedPositions } from './bracket.js';
import { EngineError } from './errors.js';
import { generateSingleElimination } from './single-elimination.js';
import {
  allSeedingModes,
  drawSizeSweep,
  fullySeeded,
  partiallySeeded,
  unseeded,
} from './testing/fixtures.js';
import type { Entrant, GeneratedStage } from './types.js';

const SEED = 'riverside-autumn-2026';

function gen(entrants: readonly Entrant[], randomSeed = SEED): GeneratedStage {
  return generateSingleElimination({ entrants, randomSeed });
}

function allMatches(stage: GeneratedStage) {
  return stage.rounds.flatMap((r) => r.matches);
}

/** Every entrant id appearing in round 0, byes included. */
function firstRoundEntrants(stage: GeneratedStage): string[] {
  const round = stage.rounds[0];
  if (round === undefined) return [];
  return round.matches
    .flatMap((m) => m.sides.map((s) => s.entrantId))
    .filter((id): id is string => id !== null);
}

describe('generateSingleElimination', () => {
  describe('structure', () => {
    it('builds the published shape for a clean 8-draw', () => {
      const stage = gen(fullySeeded(8));

      expect(stage.kind).toBe('singleElimination');
      expect(stage.rounds.map((r) => r.name)).toEqual([
        'Quarterfinal',
        'Semifinal',
        'Final',
      ]);
      expect(stage.rounds.map((r) => r.matches.length)).toEqual([4, 2, 1]);
      expect(stage.meta.byeCount).toBe(0);
    });

    it('seeds the opening round as 1v8, 4v5, 2v7, 3v6', () => {
      const stage = gen(fullySeeded(8));
      const round0 = stage.rounds[0];
      const pairs = round0?.matches.map((m) => m.sides.map((s) => s.entrantId));

      // fullySeeded assigns seed i+1 to entrant e{i+1}, so seed n === `e${n}`.
      expect(pairs).toEqual([
        ['e1', 'e8'],
        ['e4', 'e5'],
        ['e2', 'e7'],
        ['e3', 'e6'],
      ]);
    });

    it('wires every later-round side to the match that feeds it', () => {
      const stage = gen(unseeded(16));

      for (const round of stage.rounds.slice(1)) {
        for (const match of round.matches) {
          for (const side of match.sides) {
            expect(side.sourceRef?.kind).toBe('winnerOf');
          }
        }
      }
    });

    it('leaves no sourceRef pointing at a match that does not exist', () => {
      const stage = gen(partiallySeeded(23, 4));
      const ids = new Set(allMatches(stage).map((m) => m.id));

      for (const match of allMatches(stage)) {
        for (const side of match.sides) {
          const ref = side.sourceRef;
          if (ref?.kind === 'winnerOf' || ref?.kind === 'loserOf') {
            expect(ids.has(ref.matchId)).toBe(true);
          }
        }
      }
    });

    it('gives every match a unique id', () => {
      const stage = gen(unseeded(64));
      const ids = allMatches(stage).map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  /**
   * Formats spec §6.1 and §6.2: the exhaustive sweep. Every field size in
   * 2..128, in all three seeding modes.
   */
  describe('exhaustive sweep, 2..128 entrants x 3 seeding modes', () => {
    it('places every entrant exactly once in the opening round', () => {
      for (const n of drawSizeSweep()) {
        for (const { label, entrants } of allSeedingModes(n)) {
          const placed = firstRoundEntrants(gen(entrants));
          expect(new Set(placed).size, `n=${n} ${label}`).toBe(n);
          expect(placed.length, `n=${n} ${label}`).toBe(n);
        }
      }
    });

    it('produces the right match count: bracketSize - 1', () => {
      for (const n of drawSizeSweep()) {
        for (const { label, entrants } of allSeedingModes(n)) {
          const stage = gen(entrants);
          expect(allMatches(stage).length, `n=${n} ${label}`).toBe(bracketSizeFor(n) - 1);
        }
      }
    });

    it('marks exactly byeCount matches as byes', () => {
      for (const n of drawSizeSweep()) {
        for (const { label, entrants } of allSeedingModes(n)) {
          const stage = gen(entrants);
          const byes = allMatches(stage).filter((m) => m.status === 'bye');
          expect(byes.length, `n=${n} ${label}`).toBe(byeCountFor(n));
          expect(stage.meta.byeRecipients.length, `n=${n} ${label}`).toBe(byeCountFor(n));
        }
      }
    });

    it('halves the match count every round, ending in a single final', () => {
      for (const n of drawSizeSweep()) {
        const stage = gen(unseeded(n));
        const counts = stage.rounds.map((r) => r.matches.length);
        for (let i = 1; i < counts.length; i++) {
          expect((counts[i] as number) * 2, `n=${n}`).toBe(counts[i - 1] as number);
        }
        expect(counts.at(-1), `n=${n}`).toBe(1);
      }
    });

    it('never puts an entrant on both sides of a match', () => {
      for (const n of drawSizeSweep()) {
        for (const { entrants } of allSeedingModes(n)) {
          for (const match of allMatches(gen(entrants))) {
            const [a, b] = match.sides;
            if (a.entrantId !== null && b.entrantId !== null) {
              expect(a.entrantId).not.toBe(b.entrantId);
            }
          }
        }
      }
    });
  });

  describe('seeding modes', () => {
    it('reports the mode it actually used', () => {
      expect(gen(unseeded(12)).meta.seedingMode).toBe('unseeded');
      expect(gen(partiallySeeded(12, 4)).meta.seedingMode).toBe('partial');
      expect(gen(fullySeeded(12)).meta.seedingMode).toBe('seeded');
    });

    it('preserves seed separation when seeded', () => {
      // Seeds 1-2 in opposite halves, 1-4 in separate quarters, 1-8 in eighths.
      for (const n of [8, 16, 32, 64, 128]) {
        const stage = gen(fullySeeded(n));
        const round0 = stage.rounds[0];
        const slotOf = new Map<string, number>();
        round0?.matches.forEach((m, slot) => {
          for (const side of m.sides) if (side.entrantId) slotOf.set(side.entrantId, slot);
        });

        const half = round0 ? round0.matches.length / 2 : 0;
        expect(Math.floor((slotOf.get('e1') as number) / half)).not.toBe(
          Math.floor((slotOf.get('e2') as number) / half),
        );

        const quarter = round0 ? round0.matches.length / 4 : 0;
        const quarters = ['e1', 'e2', 'e3', 'e4'].map((id) =>
          Math.floor((slotOf.get(id) as number) / quarter),
        );
        expect(new Set(quarters).size).toBe(4);
      }
    });

    it('does NOT guarantee seed separation when unseeded — nothing to separate', () => {
      // Documents the deliberate difference rather than asserting an accident.
      const stage = gen(unseeded(16));
      expect(stage.meta.seededCount).toBe(0);
      expect(stage.meta.seedingMode).toBe('unseeded');
    });

    it('handles non-contiguous seed numbers by using seed order, not literal values', () => {
      const entrants: Entrant[] = [
        { id: 'a', seed: 1, status: 'active' },
        { id: 'b', seed: 2, status: 'active' },
        { id: 'c', seed: 5, status: 'active' },
        { id: 'd', seed: null, status: 'active' },
        { id: 'e', seed: null, status: 'active' },
      ];
      const stage = generateSingleElimination({ entrants, randomSeed: SEED });
      expect(stage.meta.seededCount).toBe(3);
      expect(firstRoundEntrants(stage).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });

  describe('byes', () => {
    it('awards byes to seeded entrants first, in seed order', () => {
      // 12 entrants -> 16 bracket -> 4 byes. All 12 seeded, so seeds 1-4.
      const stage = gen(fullySeeded(12));
      expect(stage.meta.byeCount).toBe(4);
      expect([...stage.meta.byeRecipients].sort()).toEqual(['e1', 'e2', 'e3', 'e4']);
    });

    it('spills leftover byes to unseeded entrants when seeds run out', () => {
      // 12 entrants, only 2 seeded -> 4 byes: 2 seeded, 2 random.
      const stage = gen(partiallySeeded(12, 2));
      expect(stage.meta.byeCount).toBe(4);
      expect(stage.meta.byeRecipients).toHaveLength(4);
      expect(stage.meta.byeRecipients).toContain('e1');
      expect(stage.meta.byeRecipients).toContain('e2');
    });

    it('assigns all byes at random when nobody is seeded', () => {
      const stage = gen(unseeded(12));
      expect(stage.meta.byeRecipients).toHaveLength(4);
      expect(new Set(stage.meta.byeRecipients).size).toBe(4);
    });

    it('models a bye as a real match with a bye sourceRef, never a hidden slot', () => {
      const stage = gen(fullySeeded(5));
      const byes = allMatches(stage).filter((m) => m.status === 'bye');

      expect(byes).toHaveLength(3);
      for (const match of byes) {
        const empty = match.sides.filter((s) => s.entrantId === null);
        const filled = match.sides.filter((s) => s.entrantId !== null);
        expect(empty).toHaveLength(1);
        expect(filled).toHaveLength(1);
        expect(empty[0]?.sourceRef).toEqual({ kind: 'bye' });
      }
    });

    it("pre-resolves a bye winner into the next round, since it's known up front", () => {
      const stage = gen(fullySeeded(5));
      const round1 = stage.rounds[1];
      const resolved = round1?.matches.flatMap((m) =>
        m.sides.filter((s) => s.entrantId !== null).map((s) => s.entrantId),
      );
      // Seeds 1, 2, 3 had byes, so all three appear in round 2 already.
      expect(resolved).toContain('e1');
      expect(resolved).toContain('e2');
      expect(resolved).toContain('e3');
    });

    it('puts byes in distinct first-round matches', () => {
      for (const n of drawSizeSweep(64)) {
        const stage = gen(fullySeeded(n));
        const byeMatches = stage.rounds[0]?.matches.filter((m) => m.status === 'bye') ?? [];
        expect(new Set(byeMatches.map((m) => m.id)).size).toBe(byeMatches.length);
      }
    });
  });

  describe('determinism', () => {
    it('produces identical output for the same seed', () => {
      const field = unseeded(37);
      expect(JSON.stringify(gen(field, 'seed-a'))).toBe(JSON.stringify(gen(field, 'seed-a')));
    });

    it('produces different placement for a different seed', () => {
      const field = unseeded(37);
      expect(JSON.stringify(gen(field, 'seed-a'))).not.toBe(JSON.stringify(gen(field, 'seed-b')));
    });

    it('is stable across 200 regenerations', () => {
      const field = partiallySeeded(24, 4);
      const expected = JSON.stringify(gen(field, 'stable'));
      for (let i = 0; i < 200; i++) {
        expect(JSON.stringify(gen(field, 'stable'))).toBe(expected);
      }
    });

    it('is unaffected by the order entrants are supplied in', () => {
      // Seeded placement must depend on seed, not on array index.
      const forwards = fullySeeded(16);
      const backwards = [...forwards].reverse();
      expect(JSON.stringify(gen(forwards).rounds)).toBe(JSON.stringify(gen(backwards).rounds));
    });
  });

  describe('small fields', () => {
    // Formats spec §6.8 — the realistic Open and A draws, where off-by-ones hide.
    it('handles a 2-entrant draw as a single final', () => {
      const stage = gen(unseeded(2));
      expect(stage.rounds).toHaveLength(1);
      expect(stage.rounds[0]?.name).toBe('Final');
      expect(stage.rounds[0]?.matches).toHaveLength(1);
      expect(stage.meta.byeCount).toBe(0);
    });

    it('handles a 3-entrant draw: one bye, one real opener, then a final', () => {
      const stage = gen(fullySeeded(3));
      expect(stage.meta.bracketSize).toBe(4);
      expect(stage.meta.byeCount).toBe(1);
      expect(stage.meta.byeRecipients).toEqual(['e1']);

      const round0 = stage.rounds[0];
      expect(round0?.matches.filter((m) => m.status === 'bye')).toHaveLength(1);
      expect(round0?.matches.filter((m) => m.status === 'pending')).toHaveLength(1);
      expect(stage.rounds[1]?.name).toBe('Final');
    });

    it('handles 4 and 5 entrant draws', () => {
      expect(gen(unseeded(4)).meta.byeCount).toBe(0);
      expect(gen(unseeded(5)).meta.byeCount).toBe(3);
      expect(allMatches(gen(unseeded(5)))).toHaveLength(7);
    });
  });

  describe('withdrawals', () => {
    it('excludes withdrawn and no-show entrants from the draw', () => {
      const entrants: Entrant[] = [
        ...unseeded(6),
        { id: 'gone', seed: null, status: 'withdrawn' },
        { id: 'absent', seed: null, status: 'noShow' },
      ];
      const stage = generateSingleElimination({ entrants, randomSeed: SEED });

      expect(stage.meta.entrantCount).toBe(6);
      expect(firstRoundEntrants(stage)).not.toContain('gone');
      expect(firstRoundEntrants(stage)).not.toContain('absent');
    });
  });

  describe('validation', () => {
    it('rejects duplicate entrant ids', () => {
      const entrants: Entrant[] = [
        { id: 'x', seed: null, status: 'active' },
        { id: 'x', seed: null, status: 'active' },
      ];
      expect(() => generateSingleElimination({ entrants, randomSeed: SEED })).toThrow(
        /appears more than once/,
      );
    });

    it('rejects duplicate seeds', () => {
      const entrants: Entrant[] = [
        { id: 'a', seed: 1, status: 'active' },
        { id: 'b', seed: 1, status: 'active' },
      ];
      expect(() => generateSingleElimination({ entrants, randomSeed: SEED })).toThrow(
        /more than one entrant/,
      );
    });

    it('rejects out-of-range seeds', () => {
      for (const seed of [0, -1, 99]) {
        const entrants: Entrant[] = [
          { id: 'a', seed, status: 'active' },
          { id: 'b', seed: null, status: 'active' },
        ];
        expect(() => generateSingleElimination({ entrants, randomSeed: SEED })).toThrow(
          EngineError,
        );
      }
    });

    it('rejects a field of fewer than two active entrants', () => {
      expect(() => gen(unseeded(1))).toThrow(/at least 2/);
      expect(() => gen([])).toThrow(EngineError);
    });

    it('rejects fields above 128', () => {
      expect(() => gen(unseeded(129))).toThrow(/not supported/);
    });
  });

  describe('meta.description', () => {
    it('states an unseeded draw with random byes in words', () => {
      expect(gen(unseeded(12)).meta.description).toBe(
        'Unseeded random draw of 12 entrants in a 16 bracket — 4 byes assigned at random.',
      );
    });

    it('states a fully seeded draw with seeded byes', () => {
      expect(gen(fullySeeded(12)).meta.description).toBe(
        'Fully seeded draw of 12 entrants in a 16 bracket — 4 byes to seeds 1–4.',
      );
    });

    it('states the split when byes spill past the seeds', () => {
      expect(gen(partiallySeeded(12, 2)).meta.description).toBe(
        '2 of 12 entrants seeded in a 16 bracket — 4 byes: 2 to seeds 1–2, 2 assigned at random among unseeded entrants.',
      );
    });

    it('says so plainly when there are no byes', () => {
      expect(gen(unseeded(16)).meta.description).toBe(
        'Unseeded random draw of 16 entrants in a 16 bracket — no byes.',
      );
    });

    it('uses the singular for a single bye', () => {
      expect(gen(fullySeeded(3)).meta.description).toContain('1 bye to seed 1');
    });
  });

  describe('avoidSameClubRound1', () => {
    it('reduces same-club openers when it can', () => {
      // Two big clubs, 16 unseeded players. Unconstrained draws will collide.
      const entrants = unseeded(16, { clubFor: (i) => (i % 2 === 0 ? 'north' : 'south') });

      const constrained = generateSingleElimination({
        entrants,
        randomSeed: 'clubs',
        avoidSameClubRound1: true,
      });

      const collisions = (stage: GeneratedStage): number => {
        const clubOf = new Map(entrants.map((e) => [e.id, e.clubId]));
        let n = 0;
        for (const m of stage.rounds[0]?.matches ?? []) {
          const [a, b] = m.sides;
          if (a.entrantId && b.entrantId) {
            if (clubOf.get(a.entrantId) === clubOf.get(b.entrantId)) n++;
          }
        }
        return n;
      };

      // 8 from each club across 8 matches: a perfect split is achievable.
      expect(collisions(constrained)).toBe(0);
    });

    it('still produces a valid draw when the constraint is impossible', () => {
      // Everyone in one club — no arrangement avoids a same-club opener.
      const entrants = unseeded(8, { clubFor: () => 'only-club' });
      const stage = generateSingleElimination({
        entrants,
        randomSeed: 'impossible',
        avoidSameClubRound1: true,
      });

      expect(firstRoundEntrants(stage)).toHaveLength(8);
      expect(allMatches(stage)).toHaveLength(7);
    });

    it('leaves seeded placement untouched', () => {
      const entrants = partiallySeeded(16, 4, { clubFor: (i) => `club-${i % 3}` });
      const stage = generateSingleElimination({
        entrants,
        randomSeed: 'seeds-fixed',
        avoidSameClubRound1: true,
      });

      const positions = seedPositions(16);
      const round0 = stage.rounds[0];
      for (const seed of [1, 2, 3, 4]) {
        const position = positions[seed] as number;
        const match = round0?.matches[Math.floor(position / 2)];
        const side = match?.sides[(position % 2) as 0 | 1];
        expect(side?.entrantId).toBe(`e${seed}`);
      }
    });
  });
});
