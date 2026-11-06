import { describe, expect, it } from 'vitest';
import { annotatedRow, clipName, NAME_BUDGET, rowScore, sideGames } from './draw-sheet-format';
import type { DrawMatch } from './queries';

function match(overrides: Partial<DrawMatch> = {}): DrawMatch {
  return {
    id: 'm1',
    engineMatchId: 'r0m0',
    slotIndex: 0,
    status: 'complete',
    outcome: 'completed',
    winnerEntrantId: 'a',
    sides: [
      { position: 0, entrantId: 'a', name: 'Alvarez', seed: 1, source: null },
      { position: 1, entrantId: 'b', name: 'Chen', seed: null, source: null },
    ],
    sets: [],
    ...overrides,
  };
}

function set(side0Games: number, side1Games: number, tb0: number | null = null, tb1: number | null = null) {
  return {
    side0Games,
    side1Games,
    side0TiebreakPoints: tb0,
    side1TiebreakPoints: tb1,
  };
}

describe('clipName', () => {
  it('leaves a name that fits untouched', () => {
    expect(clipName('Alvarez')).toBe('Alvarez');
  });

  it('keeps a doubles pair of long Mexican surnames whole', () => {
    // The case the budget was chosen for.
    const pair = 'Hernández / Rodríguez';
    expect(pair.length).toBeLessThanOrEqual(NAME_BUDGET);
    expect(clipName(pair)).toBe(pair);
  });

  it('clips at the budget and marks the clip', () => {
    const clipped = clipName('a'.repeat(NAME_BUDGET + 10));
    expect(clipped).toHaveLength(NAME_BUDGET);
    expect(clipped.endsWith('…')).toBe(true);
  });

  it('does not clip a name of exactly the budget', () => {
    const exact = 'a'.repeat(NAME_BUDGET);
    expect(clipName(exact)).toBe(exact);
  });
});

describe('sideGames', () => {
  it('is empty when no set has been recorded', () => {
    expect(sideGames(match(), 0)).toBe('');
  });

  it('reads out one side of the score', () => {
    const m = match({ sets: [set(6, 3), set(4, 6), set(7, 5)] });
    expect(sideGames(m, 0)).toBe('6 4 7');
    expect(sideGames(m, 1)).toBe('3 6 5');
  });

  it('puts tiebreak points in parentheses on the side that has them', () => {
    const m = match({ sets: [set(7, 6, null, 5)] });
    expect(sideGames(m, 0)).toBe('7');
    expect(sideGames(m, 1)).toBe('6(5)');
  });

  it('shows a zero rather than treating it as missing', () => {
    const m = match({ sets: [set(6, 0)] });
    expect(sideGames(m, 1)).toBe('0');
  });
});

describe('annotatedRow', () => {
  it('is null for a match that was played out', () => {
    expect(annotatedRow(match({ outcome: 'completed' }))).toBeNull();
  });

  it('is null when there is no outcome at all', () => {
    expect(annotatedRow(match({ outcome: null }))).toBeNull();
  });

  it('marks the side that retired, not the winner', () => {
    // Winner is side 0, so the marking belongs on side 1.
    expect(annotatedRow(match({ outcome: 'retirement', winnerEntrantId: 'a' }))).toBe(1);
    expect(annotatedRow(match({ outcome: 'retirement', winnerEntrantId: 'b' }))).toBe(0);
  });

  it('marks a walkover against the side that did not appear', () => {
    expect(annotatedRow(match({ outcome: 'walkover', winnerEntrantId: 'b' }))).toBe(0);
  });

  it('falls back to the top row when no winner is recorded', () => {
    // Printing the marking on both rows would read as both players retiring.
    expect(annotatedRow(match({ outcome: 'retirement', winnerEntrantId: null }))).toBe(0);
  });
});

describe('rowScore', () => {
  it('is just the games for a normal completed match', () => {
    const m = match({ sets: [set(6, 3), set(6, 4)] });
    expect(rowScore(m, 0)).toBe('6 6');
    expect(rowScore(m, 1)).toBe('3 4');
  });

  it('appends the marking to the retiring side only', () => {
    const m = match({ outcome: 'retirement', winnerEntrantId: 'a', sets: [set(6, 3), set(2, 1)] });
    expect(rowScore(m, 0)).toBe('6 2');
    expect(rowScore(m, 1)).toBe('3 1 RET');
  });

  it('is the bare marking for a walkover, which carries no score', () => {
    const m = match({ outcome: 'walkover', winnerEntrantId: 'a', sets: [] });
    expect(rowScore(m, 0)).toBe('');
    expect(rowScore(m, 1)).toBe('W/O');
  });

  it('marks a default', () => {
    const m = match({ outcome: 'default', winnerEntrantId: 'a', sets: [] });
    expect(rowScore(m, 1)).toBe('DEF');
  });
});
