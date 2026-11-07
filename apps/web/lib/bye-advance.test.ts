import { describe, expect, it } from 'vitest';
import {
  blocksUpstreamClear,
  byeAdvanceWinner,
  reconcileByeAdvances,
} from './bye-advance';

describe('byeAdvanceWinner', () => {
  it('advances a feeder entrant through a bye', () => {
    expect(
      byeAdvanceWinner([
        { entrantId: 'rivas', sourceKind: 'loserOf' },
        { entrantId: null, sourceKind: 'bye' },
      ]),
    ).toBe('rivas');
  });

  describe('reconcileByeAdvances', () => {
    it('auto-advances existing feeder results through pending bye matches only', () => {
      expect(
        reconcileByeAdvances(
          [
            { id: 'feeder', status: 'complete', winnerEntrantId: 'rivas' },
            { id: 'consolation-sf', status: 'pending', winnerEntrantId: null },
            { id: 'consolation-final', status: 'pending', winnerEntrantId: null },
            { id: 'played-final', status: 'complete', winnerEntrantId: 'other' },
          ],
          [
            { id: 'f0', matchId: 'feeder', entrantId: 'salas', sourceKind: null, sourceMatchId: null },
            { id: 'f1', matchId: 'feeder', entrantId: 'rivas', sourceKind: null, sourceMatchId: null },
            {
              id: 'c0',
              matchId: 'consolation-sf',
              entrantId: null,
              sourceKind: 'loserOf',
              sourceMatchId: 'feeder',
            },
            { id: 'c1', matchId: 'consolation-sf', entrantId: null, sourceKind: 'bye', sourceMatchId: null },
            {
              id: 'cf0',
              matchId: 'consolation-final',
              entrantId: null,
              sourceKind: 'winnerOf',
              sourceMatchId: 'consolation-sf',
            },
            {
              id: 'cf1',
              matchId: 'consolation-final',
              entrantId: null,
              sourceKind: 'bye',
              sourceMatchId: null,
            },
            {
              id: 'p0',
              matchId: 'played-final',
              entrantId: 'rivas',
              sourceKind: 'winnerOf',
              sourceMatchId: 'feeder',
            },
            { id: 'p1', matchId: 'played-final', entrantId: 'other', sourceKind: null, sourceMatchId: null },
          ],
        ),
      ).toEqual({
        sideUpdates: [
          { id: 'c0', entrantId: 'salas' },
          { id: 'cf0', entrantId: 'salas' },
        ],
        matchUpdates: [
          { id: 'consolation-sf', status: 'bye', winnerEntrantId: 'salas' },
          { id: 'consolation-final', status: 'bye', winnerEntrantId: 'salas' },
        ],
      });
    });
  });

  describe('blocksUpstreamClear', () => {
    it('does not treat an automatic bye as a played downstream result', () => {
      expect(blocksUpstreamClear('bye', 'rivas')).toBe(false);
      expect(blocksUpstreamClear('complete', 'rivas')).toBe(true);
      expect(blocksUpstreamClear('pending', null)).toBe(false);
    });
  });

  it('waits until a feeder entrant is known', () => {
    expect(
      byeAdvanceWinner([
        { entrantId: null, sourceKind: 'loserOf' },
        { entrantId: null, sourceKind: 'bye' },
      ]),
    ).toBeNull();
  });

  it('does not auto-advance an ordinary match', () => {
    expect(
      byeAdvanceWinner([
        { entrantId: 'a', sourceKind: null },
        { entrantId: 'b', sourceKind: null },
      ]),
    ).toBeNull();
  });
});
