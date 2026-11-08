import { describe, expect, it } from 'vitest';
import { isCellLinkable, overviewCellState } from './overview-cell';

describe('overviewCellState', () => {
  it('is playable once a bracket exists', () => {
    expect(
      overviewCellState({ status: 'published', matchCount: 7, entrantCount: 8 }),
    ).toBe('playable');
    expect(
      overviewCellState({ status: 'inProgress', matchCount: 7, entrantCount: 8 }),
    ).toBe('playable');
    expect(
      overviewCellState({ status: 'complete', matchCount: 7, entrantCount: 8 }),
    ).toBe('playable');
  });

  it('says not generated when there are entrants but no matches', () => {
    // No fixture for this on the development branch, which is the reason
    // this function is testable at all.
    expect(
      overviewCellState({ status: 'published', matchCount: 0, entrantCount: 11 }),
    ).toBe('notGenerated');
  });

  it('is empty when the category exists but nobody has entered', () => {
    expect(overviewCellState({ status: 'published', matchCount: 0, entrantCount: 0 })).toBe(
      'empty',
    );
  });

  /*
   * The rule that is easy to get backwards. An organizer who marked a
   * category not held has decided; "not generated yet" there reads as an
   * outstanding task to them and as "keep checking" to a player.
   */
  it('lets notRun win over every other signal', () => {
    expect(overviewCellState({ status: 'notRun', matchCount: 0, entrantCount: 0 })).toBe('notHeld');
    expect(overviewCellState({ status: 'notRun', matchCount: 0, entrantCount: 9 })).toBe('notHeld');
    // Even with matches already generated before it was called off.
    expect(overviewCellState({ status: 'notRun', matchCount: 7, entrantCount: 8 })).toBe('notHeld');
  });

  it('distinguishes all four states, so none can collapse into another', () => {
    const states = new Set([
      overviewCellState({ status: 'notRun', matchCount: 0, entrantCount: 0 }),
      overviewCellState({ status: 'published', matchCount: 7, entrantCount: 8 }),
      overviewCellState({ status: 'published', matchCount: 0, entrantCount: 8 }),
      overviewCellState({ status: 'published', matchCount: 0, entrantCount: 0 }),
    ]);
    expect(states.size).toBe(4);
  });
});

describe('isCellLinkable', () => {
  it('links only a generated draw', () => {
    expect(isCellLinkable('playable')).toBe(true);
    // The other three would open a page repeating what the cell says —
    // the dead control OT-15 refused for the same reason.
    for (const state of ['notHeld', 'notGenerated', 'empty'] as const) {
      expect(isCellLinkable(state)).toBe(false);
    }
  });
});
