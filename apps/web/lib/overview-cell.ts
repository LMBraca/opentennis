/**
 * OT-17 — what a visitor can do with one category on the overview.
 *
 * Pure and separate from the page because two of the four states have no
 * fixture on the development branch, so the only way to know they are
 * right is a test. The redirect this page replaced hid exactly these cases:
 * a category marked "not held" and a published category with no bracket
 * both simply vanished, and a visitor looking for one of them had no way
 * to find out what happened.
 */

export interface OverviewCellStatus {
  /** As stored on `events.status`. */
  readonly status: string;
  /** Playable matches, byes excluded. */
  readonly matchCount: number;
  /** Active entrants. */
  readonly entrantCount: number;
}

export type CellState = 'notHeld' | 'playable' | 'notGenerated' | 'empty';

/**
 * Order matters, and the first rule is the one that is easy to get wrong.
 *
 * `notRun` wins over everything else. An organizer who marked a category
 * not held has said so deliberately, and a cell reading "has not been
 * generated yet" there invites them to wonder whether they still owe it a
 * draw — or worse, invites a player to keep checking back.
 */
export function overviewCellState(cell: OverviewCellStatus): CellState {
  if (cell.status === 'notRun') return 'notHeld';
  if (cell.matchCount > 0) return 'playable';
  if (cell.entrantCount > 0) return 'notGenerated';
  return 'empty';
}

/** Only a generated draw has a page worth opening. */
export function isCellLinkable(state: CellState): boolean {
  return state === 'playable';
}
