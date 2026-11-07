import { describe, expect, it } from 'vitest';
import { reconcileScheduleDisplay } from './schedule-display';

const config = new Map([['event', { matchMinutes: 60, minRestMinutes: 60 }]]);
const date = (hour: number, minute = 0): Date =>
  new Date(`2026-11-20T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);

describe('reconcileScheduleDisplay', () => {
  it('derives a completed feeder loser through a consolation bye without a court slot', () => {
    const view = reconcileScheduleDisplay(
      [
        {
          id: 'feeder',
          eventId: 'event',
          groupId: null,
          status: 'complete',
          winnerEntrantId: 'salas',
          scheduledAt: date(10, 30),
          completedAt: date(11, 30),
          courtName: 'Cancha 1',
        },
        {
          id: 'consolation-bye',
          eventId: 'event',
          groupId: null,
          status: 'pending',
          winnerEntrantId: null,
          scheduledAt: date(8),
          completedAt: null,
          courtName: 'Cancha 2',
        },
        {
          id: 'consolation-final',
          eventId: 'event',
          groupId: null,
          status: 'pending',
          winnerEntrantId: null,
          scheduledAt: date(12),
          completedAt: null,
          courtName: 'Cancha 1',
        },
      ],
      [
        {
          id: 'cf0',
          matchId: 'feeder',
          position: 0,
          entrantId: 'salas',
          sourceKind: null,
          sourceMatchId: null,
          sourceGroupId: null,
        },
        {
          id: 'cf1',
          matchId: 'feeder',
          position: 1,
          entrantId: 'rivas',
          sourceKind: null,
          sourceMatchId: null,
          sourceGroupId: null,
        },
        {
          id: 'c0',
          matchId: 'consolation-bye',
          position: 0,
          entrantId: null,
          sourceKind: 'loserOf',
          sourceMatchId: 'feeder',
          sourceGroupId: null,
        },
        {
          id: 'c1',
          matchId: 'consolation-bye',
          position: 1,
          entrantId: null,
          sourceKind: 'bye',
          sourceMatchId: null,
          sourceGroupId: null,
        },
        {
          id: 'f0',
          matchId: 'consolation-final',
          position: 0,
          entrantId: null,
          sourceKind: 'winnerOf',
          sourceMatchId: 'consolation-bye',
          sourceGroupId: null,
        },
        {
          id: 'f1',
          matchId: 'consolation-final',
          position: 1,
          entrantId: 'other',
          sourceKind: null,
          sourceMatchId: null,
          sourceGroupId: null,
        },
      ],
      config,
    );

    expect(view.matches.get('consolation-bye')).toMatchObject({
      status: 'bye',
      winnerEntrantId: 'rivas',
      scheduledAt: null,
      courtName: null,
    });
    expect(view.sides.find((side) => side.id === 'c0')?.entrantId).toBe('rivas');
    expect(view.matches.get('consolation-final')).toMatchObject({
      scheduledAt: null,
      courtName: null,
    });
  });

  it('hides a stale downstream court slot until feeder completion and player rest', () => {
    const view = reconcileScheduleDisplay(
      [
        {
          id: 'feeder',
          eventId: 'event',
          groupId: null,
          status: 'complete',
          winnerEntrantId: 'salas',
          scheduledAt: date(10, 30),
          completedAt: date(11, 30),
          courtName: 'Cancha 1',
        },
        {
          id: 'downstream',
          eventId: 'event',
          groupId: null,
          status: 'pending',
          winnerEntrantId: null,
          scheduledAt: date(12),
          completedAt: null,
          courtName: 'Cancha 2',
        },
      ],
      [
        {
          id: 'f0',
          matchId: 'feeder',
          position: 0,
          entrantId: 'salas',
          sourceKind: null,
          sourceMatchId: null,
          sourceGroupId: null,
        },
        {
          id: 'f1',
          matchId: 'feeder',
          position: 1,
          entrantId: 'rivas',
          sourceKind: null,
          sourceMatchId: null,
          sourceGroupId: null,
        },
        {
          id: 'd0',
          matchId: 'downstream',
          position: 0,
          entrantId: null,
          sourceKind: 'winnerOf',
          sourceMatchId: 'feeder',
          sourceGroupId: null,
        },
        {
          id: 'd1',
          matchId: 'downstream',
          position: 1,
          entrantId: 'other',
          sourceKind: null,
          sourceMatchId: null,
          sourceGroupId: null,
        },
      ],
      config,
    );

    expect(view.matches.get('downstream')).toMatchObject({
      scheduledAt: null,
      courtName: null,
    });
  });
});
