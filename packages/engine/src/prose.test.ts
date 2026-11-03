import { describe, expect, it } from 'vitest';
import { article, plural } from './prose';

describe('article', () => {
  it('uses "an" before 8 and anything starting with 8', () => {
    for (const n of [8, 80, 88, 800, 8192]) expect(`${article(n)} ${n}`).toBe(`an ${n}`);
  });

  it('uses "an" before 11 and 18, which are read "eleven" and "eighteen"', () => {
    expect(article(11)).toBe('an');
    expect(article(18)).toBe('an');
  });

  it('uses "a" before 1, read "one" rather than "eighteen"', () => {
    expect(article(1)).toBe('a');
  });

  it('uses "a" for 110 and 180, read "one hundred ten" / "one hundred eighty"', () => {
    // Only 11xxx and 18xxx read as "eleven/eighteen thousand".
    expect(article(110)).toBe('a');
    expect(article(180)).toBe('a');
    expect(article(11000)).toBe('an');
    expect(article(18500)).toBe('an');
  });

  it('uses "a" for every other leading digit', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 9, 10, 16, 32, 64, 128]) {
      expect(article(n), String(n)).toBe('a');
    }
  });

  it('covers the real bracket sizes the engine produces', () => {
    expect(`in ${article(8)} 8 bracket`).toBe('in an 8 bracket');
    expect(`in ${article(16)} 16 bracket`).toBe('in a 16 bracket');
    expect(`in ${article(32)} 32 bracket`).toBe('in a 32 bracket');
  });
});

describe('plural', () => {
  it('uses the singular for one', () => {
    expect(plural(1, 'match', 'matches')).toBe('1 match');
    expect(plural(1, 'bye')).toBe('1 bye');
  });

  it('uses the plural otherwise, including zero', () => {
    expect(plural(0, 'bye')).toBe('0 byes');
    expect(plural(4, 'match', 'matches')).toBe('4 matches');
  });
});
