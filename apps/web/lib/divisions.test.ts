import { describe, expect, it } from 'vitest';
import { drawLabel, drawSegment, parseDrawSegment } from './divisions';

const L = {
  divisionOpen: 'Open',
  divisionMens: "Men's",
  divisionWomens: "Women's",
  singles: 'Singles',
  doubles: 'Doubles',
};

describe('parseDrawSegment', () => {
  it('reads an unprefixed segment as the open division', () => {
    // URLs printed before divisions existed must keep working.
    expect(parseDrawSegment('singles')).toEqual({ division: 'open', discipline: 'singles' });
    expect(parseDrawSegment('doubles')).toEqual({ division: 'open', discipline: 'doubles' });
  });

  it('reads a prefixed segment', () => {
    expect(parseDrawSegment('womens-singles')).toEqual({ division: 'womens', discipline: 'singles' });
    expect(parseDrawSegment('mens-doubles')).toEqual({ division: 'mens', discipline: 'doubles' });
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'mixed-singles', 'womens', 'singles-womens', 'womens-mixed', 'WOMENS-SINGLES']) {
      expect(parseDrawSegment(bad), bad).toBeNull();
    }
  });
});

describe('drawSegment', () => {
  it('omits the prefix for the open division', () => {
    expect(drawSegment('open', 'singles')).toBe('singles');
  });

  it('round-trips every combination', () => {
    for (const division of ['open', 'mens', 'womens'] as const) {
      for (const discipline of ['singles', 'doubles'] as const) {
        expect(parseDrawSegment(drawSegment(division, discipline))).toEqual({ division, discipline });
      }
    }
  });
});

describe('drawLabel', () => {
  it('leaves an open draw unqualified', () => {
    // A club running no women's events should not see "Open" on every row.
    expect(drawLabel('C+', 'open', 'singles', L)).toBe('C+ Singles');
  });

  it('names the division otherwise', () => {
    expect(drawLabel('A', 'womens', 'doubles', L)).toBe("A Women's Doubles");
    expect(drawLabel('B', 'mens', 'singles', L)).toBe("B Men's Singles");
  });
});
