import { describe, expect, it } from 'vitest';
import { generateConsolation } from './consolation';
import { generateSingleElimination } from './single-elimination';
import { generateRoundRobin } from './round-robin';
import type { Entrant, GeneratedStage } from './types';

function field(n: number): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    seed: null,
    status: 'active' as const,
  }));
}

function main(n: number): GeneratedStage {
  return generateSingleElimination({ entrants: field(n), randomSeed: 'test' });
}

/** Round-one matches that are not byes — the consolation field. */
function feederCount(stage: GeneratedStage): number {
  return stage.rounds.find((r) => r.index === 0)?.matches.filter((m) => m.status !== 'bye').length ?? 0;
}

describe('generateConsolation', () => {
  it('is exactly (N − B) / 2 — the round-one matches actually played', () => {
    // 16 entrants, no byes: 8 first-round matches, so 8 losers.
    const m = main(16);
    expect(feederCount(m)).toBe(8);
    expect(generateConsolation(m)?.feederCount).toBe(8);
  });

  it('shrinks with byes, which is the cost of this format', () => {
    // 20 in a 32 draw: 12 byes, only 4 real first-round matches, so the
    // consolation draw is four players — not ten. An organizer will ask.
    const m = main(20);
    expect(feederCount(m)).toBe(4);
    expect(generateConsolation(m)?.feederCount).toBe(4);
  });

  it('builds a full bracket down to one final', () => {
    const result = generateConsolation(main(16));
    const rounds = result?.stage.rounds ?? [];
    expect(rounds.map((r) => r.matches.length)).toEqual([4, 2, 1]);
    expect(rounds.at(-1)?.name).toBe('Consolation final');
  });

  it('feeds every first-round slot from loserOf a main-draw match', () => {
    const m = main(16);
    const result = generateConsolation(m);
    const mainFirstRoundIds = new Set(
      m.rounds.find((r) => r.index === 0)!.matches.map((x) => x.id),
    );

    const first = result!.stage.rounds[0]!;
    const refs = first.matches.flatMap((x) => x.sides.map((s) => s.sourceRef));
    expect(refs).toHaveLength(8);
    for (const ref of refs) {
      expect(ref?.kind).toBe('loserOf');
      if (ref?.kind === 'loserOf') expect(mainFirstRoundIds.has(ref.matchId)).toBe(true);
    }
  });

  it('never feeds from the same main match twice', () => {
    const result = generateConsolation(main(16));
    const ids = result!.stage.rounds[0]!.matches
      .flatMap((x) => x.sides.map((s) => (s.sourceRef?.kind === 'loserOf' ? s.sourceRef.matchId : null)))
      .filter((x): x is string => x !== null);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('later rounds are fed by winnerOf within the consolation bracket', () => {
    const result = generateConsolation(main(16));
    const second = result!.stage.rounds[1]!;
    for (const match of second.matches) {
      for (const side of match.sides) {
        expect(side.sourceRef?.kind).toBe('winnerOf');
        // Pointing INSIDE the consolation bracket, not back at the main one.
        if (side.sourceRef?.kind === 'winnerOf') {
          expect(side.sourceRef.matchId.startsWith('c')).toBe(true);
        }
      }
    }
  });

  it('uses its own id space so it cannot collide with the main draw', () => {
    const m = main(16);
    const mainIds = new Set(m.rounds.flatMap((r) => r.matches.map((x) => x.id)));
    const consolationIds = generateConsolation(m)!.stage.rounds.flatMap((r) =>
      r.matches.map((x) => x.id),
    );
    for (const id of consolationIds) expect(mainIds.has(id)).toBe(false);
  });

  it('does NOT mark a short-handed first round as a bye', () => {
    // 6 entrants: 2 byes, 2 real matches... so only 2 feeders, a 2-slot
    // bracket with no byes. Use 24 to get an awkward 8-into-16 shape.
    const m = main(12); // 4 byes, 4 real matches -> 4 feeders, exact fit
    const result = generateConsolation(m);
    for (const match of result!.stage.rounds[0]!.matches) {
      // A main-draw bye resolves immediately because the entrant is known.
      // Here the survivor is still "loser of a match not yet played", so
      // settling it now would advance an empty slot.
      expect(match.status).toBe('pending');
    }
  });

  it('pads an odd field with bye refs rather than dropping anyone', () => {
    // 22 entrants in 32: 10 byes, 6 real matches -> 6 feeders in an 8 draw.
    const m = main(22);
    expect(feederCount(m)).toBe(6);
    const result = generateConsolation(m)!;
    expect(result.stage.meta.bracketSize).toBe(8);
    expect(result.stage.meta.byeCount).toBe(2);

    const loserRefs = result.stage.rounds[0]!.matches
      .flatMap((x) => x.sides)
      .filter((s) => s.sourceRef?.kind === 'loserOf');
    expect(loserRefs).toHaveLength(6);
  });

  it('refuses to build a draw for fewer than two losers', () => {
    // 3 entrants: 1 bye, 1 real match, 1 loser. Nobody for them to play.
    expect(generateConsolation(main(3))).toBeNull();
    // 2 entrants is a single final: also one loser, also no draw.
    expect(generateConsolation(main(2))).toBeNull();
    // 4 entrants: 2 real matches, 2 losers — the smallest real one.
    expect(generateConsolation(main(4))?.feederCount).toBe(2);
  });

  it('rejects a round robin, which has no first round to lose in', () => {
    const rr = generateRoundRobin({ entrants: field(4), randomSeed: 'test', groupName: 'G' });
    expect(() => generateConsolation(rr)).toThrow();
  });

  it('says in words what the draw is and who misses out', () => {
    const description = generateConsolation(main(16))!.stage.meta.description;
    expect(description).toMatch(/8 first-round losers/);
    expect(description).toMatch(/bye/i);
  });

  it('is deterministic for the same main draw', () => {
    const m = main(16);
    expect(JSON.stringify(generateConsolation(m))).toBe(JSON.stringify(generateConsolation(m)));
  });

  /*
   * Six surfaces render a round name raw and several of them list matches
   * from both brackets together, so a consolation round that calls itself
   * "Semifinal" is a result entered against the main draw's semifinal.
   */
  it('names its rounds for the bracket they belong to', () => {
    const names = generateConsolation(main(16))!.stage.rounds.map((r) => r.name);
    expect(names).toEqual([
      'Consolation quarterfinal',
      'Consolation semifinal',
      'Consolation final',
    ]);
  });

  it('never gives a consolation round a main-draw round name', () => {
    for (const size of [4, 8, 16, 32, 64]) {
      for (const round of generateConsolation(main(size))!.stage.rounds) {
        expect(round.name).toMatch(/^Consolation /);
        expect(['Final', 'Semifinal', 'Quarterfinal']).not.toContain(round.name);
      }
    }
  });

  it('keeps the round-of-N form readable once prefixed', () => {
    // 64 feeders -> a round of 64, which goes through roundNameFor's
    // default branch rather than one of its three named cases.
    const names = generateConsolation(main(128))!.stage.rounds.map((r) => r.name);
    expect(names[0]).toBe('Consolation round of 64');
  });
});
