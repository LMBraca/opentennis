/**
 * Where a tournament is, and therefore what to do next.
 *
 * The admin page used to show every control from every stage at once: two
 * independent status axes with eight buttons, a registration panel saying
 * "entries are open" directly above a draws panel saying "close
 * registration to generate draws", and eight undifferentiated links at the
 * bottom, several of which render an empty page until some earlier step is
 * done. Running a tournament is a SEQUENCE, and the page did not know it.
 *
 * The phase is DERIVED, never stored. A stored phase is a third thing to
 * keep in step with `status` and `entriesOpen`, and the first time it
 * disagreed with them the page would lie. Everything here is a pure
 * function of rows that already exist.
 */

export type Phase = 'setup' | 'entries' | 'draws' | 'play' | 'done' | 'cancelled';

export interface PhaseInput {
  /** `tournaments.status`. */
  readonly status: string;
  readonly entriesOpen: boolean;
  /** Category × discipline cells the club has chosen to run. */
  readonly eventCount: number;
  /** How many of those have a generated draw. */
  readonly drawnCount: number;
  /** Matches with a winner, across the tournament. */
  readonly decidedCount: number;
  readonly matchCount: number;
}

export interface PhaseView {
  readonly phase: Phase;
  /** Short label for the rail. */
  readonly label: string;
  /** The one thing to do next, or null when there is nothing. */
  readonly next: string | null;
  /** Why that is next — shown under the action, never as a tooltip. */
  readonly detail: string | null;
}

/** Rail order. `cancelled` is deliberately absent: it is off the path. */
export const PHASE_ORDER: readonly Phase[] = ['setup', 'entries', 'draws', 'play', 'done'];

export function phaseOf(input: PhaseInput): Phase {
  if (input.status === 'cancelled') return 'cancelled';
  if (input.status === 'complete') return 'done';

  // Entries open outranks everything below it: whatever else is true, the
  // field can still change, so nothing downstream is settled.
  if (input.entriesOpen) return 'entries';

  /*
   * `draft` is the only thing that distinguishes "entries have never been
   * opened" from "entries were opened and then closed" — both are
   * entriesOpen: false. Without this a brand-new tournament with one
   * category jumps straight to "generate the draws" and the organizer is
   * never offered the step that lets anyone sign up.
   */
  if (input.status === 'draft') return 'setup';

  // Nothing to enter yet. A tournament with no categories cannot take an
  // entry, so "open entries" would produce a form with an empty dropdown.
  if (input.eventCount === 0) return 'setup';

  if (input.drawnCount < input.eventCount) return 'draws';
  if (input.matchCount > 0) return 'play';

  // Everything chosen and drawn, but no matches — an edge case rather than
  // a real state; treat it as still building.
  return 'draws';
}

const LABELS: Record<Phase, string> = {
  setup: 'Setup',
  entries: 'Entries open',
  draws: 'Draws',
  play: 'In play',
  done: 'Complete',
  cancelled: 'Cancelled',
};

export function phaseLabel(phase: Phase): string {
  return LABELS[phase];
}

/**
 * The single next action.
 *
 * One, not a list. The page's job is to answer "what now", and offering
 * three equal options is how the old page got to eight buttons.
 */
export function nextAction(input: PhaseInput): PhaseView {
  const phase = phaseOf(input);
  const base = { phase, label: LABELS[phase] } as const;

  switch (phase) {
    case 'setup':
      return input.eventCount === 0
        ? {
            ...base,
            next: 'Choose the categories you are running',
            detail: 'Pick a cell below. Nobody can enter until there is something to enter.',
          }
        : { ...base, next: 'Open entries', detail: 'Players can then sign themselves up.' };

    case 'entries':
      return {
        ...base,
        next: 'Close entries',
        detail:
          input.eventCount === 0
            ? 'No categories chosen yet — add one before closing.'
            : 'Draws can be generated once the field is settled.',
      };

    case 'draws':
      return {
        ...base,
        next: 'Generate the draws',
        detail:
          input.drawnCount === 0
            ? 'Entries are closed, so the field is settled.'
            : `${input.drawnCount} of ${input.eventCount} done.`,
      };

    case 'play':
      return input.decidedCount < input.matchCount
        ? {
            ...base,
            next: 'Record results',
            detail: `${input.decidedCount} of ${input.matchCount} matches played.`,
          }
        : { ...base, next: 'Mark the tournament complete', detail: 'Every match has a result.' };

    case 'done':
      return { ...base, next: null, detail: 'Finished. The draws stay published.' };

    case 'cancelled':
      return { ...base, next: null, detail: 'This tournament was cancelled.' };
  }
}

/**
 * Should this tool be offered yet?
 *
 * The old page listed all eight regardless, so an organizer could open an
 * order of play before anything was scheduled and find a blank sheet —
 * which reads as a broken page, not an empty one.
 */
export function toolAvailable(
  tool: 'entries' | 'scores' | 'qr' | 'sheets' | 'schedule' | 'order' | 'scorekeepers' | 'export',
  input: PhaseInput,
): boolean {
  const drawn = input.drawnCount > 0;
  switch (tool) {
    case 'qr':
      // Useful the moment there is something to sign up for.
      return input.eventCount > 0;
    case 'entries':
      return input.eventCount > 0;
    case 'sheets':
    case 'schedule':
    case 'scores':
    case 'scorekeepers':
      return drawn;
    case 'order':
      // A schedule has to exist, not just a draw.
      return drawn && input.matchCount > 0;
    case 'export':
      return input.matchCount > 0;
  }
}
