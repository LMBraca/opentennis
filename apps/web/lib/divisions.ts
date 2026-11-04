/**
 * Division helpers.
 *
 * A draw is identified by category x discipline x division. The division is
 * folded into the URL's discipline segment rather than added as a fourth
 * path segment:
 *
 *   /t/slug/c-plus/singles           open singles
 *   /t/slug/c-plus/womens-singles    women's singles
 *
 * That keeps every URL printed on a QR code before divisions existed working
 * unchanged, which the spec promises for the life of a tournament.
 */

export const DIVISIONS = ['open', 'mens', 'womens'] as const;
export type Division = (typeof DIVISIONS)[number];

export type Discipline = 'singles' | 'doubles';

export function isDivision(value: string): value is Division {
  return value === 'open' || value === 'mens' || value === 'womens';
}

/** "womens-singles" → { division: 'womens', discipline: 'singles' } */
export function parseDrawSegment(
  segment: string,
): { division: Division; discipline: Discipline } | null {
  const match = /^(?:(mens|womens)-)?(singles|doubles)$/.exec(segment);
  if (match === null) return null;
  const division = (match[1] ?? 'open') as Division;
  return { division, discipline: match[2] as Discipline };
}

/** The inverse. 'open' contributes no prefix. */
export function drawSegment(division: Division, discipline: Discipline): string {
  return division === 'open' ? discipline : `${division}-${discipline}`;
}

export interface DivisionLabels {
  readonly divisionOpen: string;
  readonly divisionMens: string;
  readonly divisionWomens: string;
  readonly singles: string;
  readonly doubles: string;
}

/**
 * "C+ Women's Singles", or "C+ Singles" when the division is open.
 *
 * An unqualified draw says nothing about division on purpose: a club that
 * runs no women's events should not see "Open" on every row.
 */
export function drawLabel(
  categoryCode: string,
  division: Division,
  discipline: Discipline,
  labels: DivisionLabels,
): string {
  const sport = discipline === 'singles' ? labels.singles : labels.doubles;
  if (division === 'open') return `${categoryCode} ${sport}`;
  const d = division === 'mens' ? labels.divisionMens : labels.divisionWomens;
  return `${categoryCode} ${d} ${sport}`;
}

export function divisionLabel(division: Division, labels: DivisionLabels): string {
  return division === 'mens'
    ? labels.divisionMens
    : division === 'womens'
      ? labels.divisionWomens
      : labels.divisionOpen;
}
