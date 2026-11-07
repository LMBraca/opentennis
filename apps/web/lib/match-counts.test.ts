import { describe, expect, it } from 'vitest';
import { matchCounts } from './match-counts';

describe('matchCounts', () => {
  it('excludes byes, including automatic feeder advances, from every scope', () => {
    const counts = matchCounts([
      { status: 'pending', sides: [{ entrantId: 'a' }, { entrantId: 'b' }] },
      { status: 'pending', sides: [{ entrantId: 'c' }, { entrantId: null }] },
      { status: 'complete', winnerEntrantId: 'a', sides: [{ entrantId: 'a' }, { entrantId: 'b' }] },
      { status: 'bye', winnerEntrantId: 'c', scheduledAt: new Date() },
      {
        status: 'pending',
        sides: [
          { entrantId: null, source: { kind: 'winnerOf' } },
          { entrantId: null, source: { kind: 'bye' } },
        ],
      },
    ]);

    expect(counts).toEqual({ total: 3, scheduled: 0, ready: 1, waiting: 1, completed: 1 });
    expect(counts.ready + counts.waiting + counts.completed).toBe(counts.total);
  });

  it('counts a scheduled playable match once even when it is still waiting', () => {
    expect(
      matchCounts([{ status: 'pending', scheduledAt: '2026-11-07', sides: [{ entrantId: null }] }]),
    ).toEqual({ total: 1, scheduled: 1, ready: 0, waiting: 1, completed: 0 });
  });
});
