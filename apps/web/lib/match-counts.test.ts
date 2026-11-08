import { describe, expect, it } from 'vitest';
import {
  isPlayable,
  matchScopes,
  scopesAreConsistent,
  type CountableMatch,
} from './match-counts';

const match = (over: Partial<CountableMatch> = {}): CountableMatch => ({
  status: 'pending',
  winnerEntrantId: null,
  scheduledAt: null,
  stageKind: 'singleElimination',
  bothSidesNamed: true,
  ...over,
});

const bye = (): CountableMatch => match({ status: 'bye', winnerEntrantId: 'e1' });
const done = (over: Partial<CountableMatch> = {}): CountableMatch =>
  match({ status: 'complete', winnerEntrantId: 'e1', ...over });

describe('matchScopes', () => {
  it('is all zeroes for nothing', () => {
    const s = matchScopes([]);
    expect(s.total).toBe(0);
    expect(scopesAreConsistent(s)).toBe(true);
  });

  /*
   * The reported defect. 35 playable matches and 22 byes read as "57
   * matches / 3 of 57 played" on the manage page while every other page
   * said 35.
   */
  it('does not count byes as matches', () => {
    const rows = [...Array(35)].map(() => match()).concat([...Array(22)].map(() => bye()));
    const s = matchScopes(rows);
    expect(s.total).toBe(35);
    expect(s.byes).toBe(22);
    // The number that was wrong: a progress denominator of 57.
    expect(s.total).not.toBe(rows.length);
  });

  it('splits main from consolation', () => {
    const s = matchScopes([
      match(),
      match(),
      match({ stageKind: 'consolation' }),
      bye(),
      match({ stageKind: 'consolation' }),
    ]);
    expect(s.main).toBe(2);
    expect(s.consolation).toBe(2);
    expect(s.total).toBe(4);
    expect(scopesAreConsistent(s)).toBe(true);
  });

  it('counts a bye in neither stage total', () => {
    // A consolation bye must not inflate the consolation header either —
    // that is the "7 Partidos on an 8-player consolation" case.
    const s = matchScopes([bye(), match({ status: 'bye', stageKind: 'consolation' })]);
    expect(s.main).toBe(0);
    expect(s.consolation).toBe(0);
    expect(s.byes).toBe(2);
  });

  it('separates ready from waiting by whether both sides are known', () => {
    const s = matchScopes([
      match({ bothSidesNamed: true }),
      match({ bothSidesNamed: true }),
      match({ bothSidesNamed: false }),
    ]);
    expect(s.ready).toBe(2);
    expect(s.waiting).toBe(1);
    expect(s.completed).toBe(0);
    expect(scopesAreConsistent(s)).toBe(true);
  });

  it('counts scheduled only among playable matches', () => {
    const s = matchScopes([
      match({ scheduledAt: new Date('2026-11-20T18:30:00Z') }),
      match(),
      // A bye with a leftover time must not be "scheduled": this is the
      // "9 matches / 8 scheduled" header mismatch.
      { ...bye(), scheduledAt: new Date('2026-11-20T16:00:00Z') },
    ]);
    expect(s.total).toBe(2);
    expect(s.scheduled).toBe(1);
  });

  it('treats a completed match as completed, not ready', () => {
    const s = matchScopes([done(), match(), match({ bothSidesNamed: false })]);
    expect(s.completed).toBe(1);
    expect(s.ready).toBe(1);
    expect(s.waiting).toBe(1);
    expect(scopesAreConsistent(s)).toBe(true);
  });

  /*
   * The half-written state the propagation-outside-the-transaction gap can
   * produce. Counting it as unfinished keeps it visible as work to do;
   * counting it as complete would quietly drop it out of the queue.
   */
  it('does not call a match complete without a winner', () => {
    const s = matchScopes([match({ status: 'complete', winnerEntrantId: null })]);
    expect(s.completed).toBe(0);
    expect(s.ready).toBe(1);
    expect(scopesAreConsistent(s)).toBe(true);
  });

  it('counts a live match as ready rather than completed', () => {
    const s = matchScopes([match({ status: 'live' })]);
    expect(s.completed).toBe(0);
    expect(s.ready).toBe(1);
  });

  it('keeps the invariant across a realistic mix', () => {
    const s = matchScopes([
      done(),
      done({ stageKind: 'consolation' }),
      match({ scheduledAt: new Date('2026-11-21T17:00:00Z') }),
      match({ bothSidesNamed: false }),
      match({ bothSidesNamed: false, stageKind: 'consolation' }),
      bye(),
      bye(),
    ]);
    expect(s.total).toBe(5);
    expect(s.byes).toBe(2);
    expect(scopesAreConsistent(s)).toBe(true);
  });
});

describe('isPlayable', () => {
  it('is the single rule the rest rests on', () => {
    expect(isPlayable(match())).toBe(true);
    expect(isPlayable(done())).toBe(true);
    expect(isPlayable(match({ status: 'live' }))).toBe(true);
    expect(isPlayable(bye())).toBe(false);
  });
});

describe('scopesAreConsistent', () => {
  it('catches a total that does not add up', () => {
    expect(
      scopesAreConsistent({
        total: 10,
        main: 10,
        consolation: 0,
        scheduled: 0,
        ready: 4,
        waiting: 4,
        completed: 1,
        byes: 0,
      }),
    ).toBe(false);
  });

  it('catches stages that do not add up to the total', () => {
    expect(
      scopesAreConsistent({
        total: 10,
        main: 6,
        consolation: 2,
        scheduled: 0,
        ready: 10,
        waiting: 0,
        completed: 0,
        byes: 0,
      }),
    ).toBe(false);
  });
});
