/**
 * How a persisted match reads on a printed draw sheet.
 *
 * Split out of `components/draw-sheet.tsx` so it can be tested: the component
 * is markup and this is the part with decisions in it. Pure — rows in, strings
 * in, no React.
 */

import type { DrawMatch } from './queries';
import { outcomeAbbreviation } from './match-result';

/**
 * Names are clipped rather than shrunk to fit.
 *
 * A squeezed name is harder to read than a clipped one and quietly implies the
 * sheet can hold more than it can. 26 characters clears every single surname
 * and a doubles pair like "Hernández / Rodríguez".
 */
export const NAME_BUDGET = 26;

export function clipName(name: string): string {
  return name.length <= NAME_BUDGET ? name : `${name.slice(0, NAME_BUDGET - 1)}…`;
}

/** "6 4 7(5)" — one side's games per set, tiebreak points in parentheses. */
export function sideGames(match: DrawMatch, position: 0 | 1): string {
  return match.sets
    .map((set) => {
      const games = position === 0 ? set.side0Games : set.side1Games;
      const tiebreak = position === 0 ? set.side0TiebreakPoints : set.side1TiebreakPoints;
      return tiebreak === null ? String(games) : `${games}(${tiebreak})`;
    })
    .join(' ');
}

/**
 * Which row carries RET / W/O / DEF, or null when the match ended normally.
 *
 * The convention on a scoresheet is that the marking sits against the player
 * it happened to — the one who retired or did not appear — so it goes on the
 * side that did NOT win. With no winner recorded there is nobody to pin it on,
 * so it goes on the top row rather than on both, which would read as both
 * players having retired.
 */
export function annotatedRow(match: DrawMatch): 0 | 1 | null {
  if (outcomeAbbreviation(match.outcome) === null) return null;
  if (match.winnerEntrantId === null) return 0;
  const loser = match.sides.find(
    (s) => s.entrantId !== null && s.entrantId !== match.winnerEntrantId,
  );
  return loser?.position === 1 ? 1 : 0;
}

/**
 * The text printed at the right-hand end of one side's rule: its games, plus
 * the outcome marking when this is the side the marking belongs to.
 */
export function rowScore(match: DrawMatch, position: 0 | 1): string {
  const games = sideGames(match, position);
  const mark = annotatedRow(match) === position ? outcomeAbbreviation(match.outcome) : null;
  return [games, mark].filter((part) => part !== null && part !== '').join(' ');
}
