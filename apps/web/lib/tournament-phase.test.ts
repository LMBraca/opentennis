import { describe, expect, it } from 'vitest';
import { nextAction, phaseOf, toolAvailable, type PhaseInput } from './tournament-phase';

function state(overrides: Partial<PhaseInput> = {}): PhaseInput {
  return {
    status: 'published',
    entriesOpen: false,
    eventCount: 0,
    drawnCount: 0,
    decidedCount: 0,
    matchCount: 0,
    ...overrides,
  };
}

describe('phaseOf', () => {
  it('starts in setup with nothing chosen', () => {
    expect(phaseOf(state({ status: 'draft' }))).toBe('setup');
  });

  it('stays in setup while still a draft, even with a category chosen', () => {
    // draft is the ONLY thing separating "never opened entries" from
    // "closed them again"; both are entriesOpen: false. Without it a new
    // tournament skips straight past the step that lets anyone sign up.
    expect(phaseOf(state({ status: 'draft', eventCount: 1 }))).toBe('setup');
  });

  it('is entries whenever entries are open, whatever else is true', () => {
    // The field can still change, so nothing downstream is settled — even
    // if somebody generated a draw early.
    expect(phaseOf(state({ entriesOpen: true }))).toBe('entries');
    expect(
      phaseOf(state({ entriesOpen: true, eventCount: 2, drawnCount: 2, matchCount: 30 })),
    ).toBe('entries');
  });

  it('is draws once entries close and something is still undrawn', () => {
    expect(phaseOf(state({ eventCount: 2, drawnCount: 1 }))).toBe('draws');
    expect(phaseOf(state({ eventCount: 2, drawnCount: 0 }))).toBe('draws');
  });

  it('is in play once everything is drawn', () => {
    expect(phaseOf(state({ eventCount: 1, drawnCount: 1, matchCount: 15 }))).toBe('play');
  });

  it('respects an explicit complete or cancelled status over anything derived', () => {
    expect(phaseOf(state({ status: 'complete', entriesOpen: true }))).toBe('done');
    expect(phaseOf(state({ status: 'cancelled', entriesOpen: true }))).toBe('cancelled');
  });

  it('stays in setup with no categories, even when published', () => {
    // "Open entries" on a tournament with nothing to enter produces a form
    // with an empty dropdown.
    expect(phaseOf(state({ eventCount: 0 }))).toBe('setup');
  });
});

describe('nextAction', () => {
  it('asks for categories before anything else', () => {
    expect(nextAction(state({ status: 'draft' })).next).toMatch(/categories/i);
  });

  it('offers to open entries once a category exists on a draft', () => {
    expect(nextAction(state({ status: 'draft', eventCount: 1 })).next).toMatch(/open entries/i);
  });

  it('offers to close entries while they are open', () => {
    expect(nextAction(state({ entriesOpen: true, eventCount: 1 })).next).toMatch(/close entries/i);
  });

  it('warns when closing with nothing to draw', () => {
    expect(nextAction(state({ entriesOpen: true, eventCount: 0 })).detail).toMatch(/no categories/i);
  });

  it('reports draw progress rather than just saying generate', () => {
    expect(nextAction(state({ eventCount: 3, drawnCount: 1 })).detail).toBe('1 of 3 done.');
  });

  it('asks for results while matches remain', () => {
    const view = nextAction(state({ eventCount: 1, drawnCount: 1, matchCount: 10, decidedCount: 4 }));
    expect(view.next).toMatch(/record results/i);
    expect(view.detail).toBe('4 of 10 matches played.');
  });

  it('offers completion only once every match has a result', () => {
    const view = nextAction(
      state({ eventCount: 1, drawnCount: 1, matchCount: 10, decidedCount: 10 }),
    );
    expect(view.next).toMatch(/complete/i);
  });

  it('has nothing left to ask for when done', () => {
    expect(nextAction(state({ status: 'complete' })).next).toBeNull();
    expect(nextAction(state({ status: 'cancelled' })).next).toBeNull();
  });
});

describe('toolAvailable', () => {
  it('hides everything that needs a draw until one exists', () => {
    const s = state({ eventCount: 1, entriesOpen: true });
    for (const tool of ['sheets', 'schedule', 'scores', 'scorekeepers'] as const) {
      expect(toolAvailable(tool, s)).toBe(false);
    }
  });

  it('offers the QR codes as soon as there is something to enter', () => {
    expect(toolAvailable('qr', state({ eventCount: 0 }))).toBe(false);
    expect(toolAvailable('qr', state({ eventCount: 1 }))).toBe(true);
  });

  it('withholds the order of play until matches exist, not just a draw', () => {
    // An order of play with no matches is a blank sheet, which reads as a
    // broken page rather than an empty one.
    expect(toolAvailable('order', state({ drawnCount: 1, matchCount: 0 }))).toBe(false);
    expect(toolAvailable('order', state({ drawnCount: 1, matchCount: 8 }))).toBe(true);
  });

  it('withholds the export until there is something to export', () => {
    expect(toolAvailable('export', state({ matchCount: 0 }))).toBe(false);
    expect(toolAvailable('export', state({ matchCount: 1 }))).toBe(true);
  });
});

/*
 * Both of these shipped. The panel guarded its button with
 * `phase !== 'setup-empty'` — a phase that is not in the union — and the
 * prop was typed `string`, so the comparison compiled, was always true,
 * and the button always rendered.
 */
describe('which steps are a button', () => {
  const input = {
    status: 'draft' as const,
    entriesOpen: false,
    eventCount: 0,
    drawnCount: 0,
    matchCount: 0,
    decidedCount: 0,
  };

  it('offers no button before any category exists', () => {
    const view = nextAction(input);
    // Pressing it published the tournament and opened entries on a
    // tournament with nothing to enter — exactly what its subtitle forbids.
    expect(view.actionable).toBe(false);
    expect(view.link).toBeNull();
  });

  it('offers one once a category exists', () => {
    expect(nextAction({ ...input, eventCount: 2 }).actionable).toBe(true);
  });

  it('sends the organizer to the scores page instead of advancing mid-play', () => {
    const view = nextAction({
      ...input,
      status: 'inProgress',
      eventCount: 2,
      drawnCount: 2,
      matchCount: 10,
      decidedCount: 3,
    });
    expect(view.next).toBe('Record results');
    /*
     * `advancePhase` on the play phase marks the tournament COMPLETE. A
     * button labelled "Record results" doing that, pressed by someone
     * expecting the scores screen, ended the tournament mid-draw.
     */
    expect(view.actionable).toBe(false);
    expect(view.link).toBe('scores');
  });

  it('does offer the completing button once every match has a result', () => {
    const view = nextAction({
      ...input,
      status: 'inProgress',
      eventCount: 2,
      drawnCount: 2,
      matchCount: 10,
      decidedCount: 10,
    });
    expect(view.next).toBe('Mark the tournament complete');
    expect(view.actionable).toBe(true);
  });

  it('never marks a finished or cancelled tournament actionable', () => {
    for (const status of ['complete', 'cancelled'] as const) {
      const view = nextAction({ ...input, status, eventCount: 2 });
      expect(view.actionable).toBe(false);
      expect(view.next).toBeNull();
    }
  });
});
