import { describe, expect, it } from 'vitest';
import { generateSingleElimination } from './single-elimination.js';
import { fullySeeded, unseeded } from './testing/fixtures.js';
import type { GeneratedStage } from './types.js';

const SEED = 'third-place';

function withPlayoff(count: number): GeneratedStage {
  return generateSingleElimination({
    entrants: unseeded(count),
    randomSeed: SEED,
    thirdPlacePlayoff: true,
  });
}

function playoffRound(stage: GeneratedStage) {
  return stage.rounds.find((r) => r.kind === 'thirdPlace');
}

describe('third-place playoff', () => {
  it('is absent unless asked for', () => {
    const stage = generateSingleElimination({ entrants: unseeded(8), randomSeed: SEED });
    expect(playoffRound(stage)).toBeUndefined();
    expect(stage.rounds.every((r) => r.kind === 'main')).toBe(true);
  });

  it('adds exactly one match, fed by the losers of both semifinals', () => {
    const stage = withPlayoff(8);
    const round = playoffRound(stage);

    expect(round).toBeDefined();
    expect(round?.name).toBe('Third-place playoff');
    expect(round?.matches).toHaveLength(1);

    const semifinals = stage.rounds.find((r) => r.name === 'Semifinal');
    const semifinalIds = semifinals?.matches.map((m) => m.id);

    const sides = round?.matches[0]?.sides ?? [];
    expect(sides.map((s) => s.sourceRef?.kind)).toEqual(['loserOf', 'loserOf']);

    const referenced = sides.map((s) =>
      s.sourceRef?.kind === 'loserOf' ? s.sourceRef.matchId : null,
    );
    expect(referenced).toEqual(semifinalIds);
  });

  it('leaves both sides unresolved — a loser is not known until the match is played', () => {
    const sides = playoffRound(withPlayoff(16))?.matches[0]?.sides ?? [];
    expect(sides.every((s) => s.entrantId === null)).toBe(true);
  });

  it('does not disturb the main bracket', () => {
    const plain = generateSingleElimination({ entrants: unseeded(16), randomSeed: SEED });
    const withIt = withPlayoff(16);

    const mainOf = (s: GeneratedStage) => s.rounds.filter((r) => r.kind === 'main');
    expect(JSON.stringify(mainOf(withIt))).toBe(JSON.stringify(mainOf(plain)));
  });

  it('adds one match to the total count and nothing else', () => {
    for (const n of [4, 5, 8, 12, 16, 33, 64]) {
      const plain = generateSingleElimination({ entrants: unseeded(n), randomSeed: SEED });
      const withIt = withPlayoff(n);

      const count = (s: GeneratedStage) => s.rounds.flatMap((r) => r.matches).length;
      expect(count(withIt), `n=${n}`).toBe(count(plain) + 1);
    }
  });

  it('works at the smallest bracket that has semifinals', () => {
    // 4 entrants: two semifinals, a final, and now a third-place match.
    const stage = withPlayoff(4);
    expect(stage.rounds.map((r) => r.name)).toEqual([
      'Semifinal',
      'Final',
      'Third-place playoff',
    ]);
  });

  it('is ignored for a 2-entrant draw, which has no semifinal', () => {
    // Erroring at an organizer for a toggle that cannot apply is worse than
    // quietly not producing the match.
    const stage = withPlayoff(2);
    expect(stage.rounds).toHaveLength(1);
    expect(stage.rounds[0]?.name).toBe('Final');
    expect(playoffRound(stage)).toBeUndefined();
  });

  it('identifies the semifinal correctly even in a large bracket with byes', () => {
    const stage = generateSingleElimination({
      entrants: fullySeeded(48),
      randomSeed: SEED,
      thirdPlacePlayoff: true,
    });
    const semifinals = stage.rounds.find((r) => r.name === 'Semifinal');
    const referenced = (playoffRound(stage)?.matches[0]?.sides ?? []).map((s) =>
      s.sourceRef?.kind === 'loserOf' ? s.sourceRef.matchId : null,
    );
    expect(referenced).toEqual(semifinals?.matches.map((m) => m.id));
  });

  it('keeps its match id distinct from every main-bracket match', () => {
    const stage = withPlayoff(32);
    const ids = stage.rounds.flatMap((r) => r.matches).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays deterministic', () => {
    expect(JSON.stringify(withPlayoff(24))).toBe(JSON.stringify(withPlayoff(24)));
  });
});
