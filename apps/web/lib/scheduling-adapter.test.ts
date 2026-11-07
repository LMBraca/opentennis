import { describe, expect, it } from 'vitest';
import { scheduleMatches } from '@opentennis/engine';
import { adaptSchedulingMatches } from './scheduling-adapter';

describe('adaptSchedulingMatches', () => {
  it('waits for a consolation feeder through a bye and player rest', () => {
    const matches = adaptSchedulingMatches(
      [
        { id: 'salas-rivas-r16', eventId: 'c-plus-singles', roundIndex: 2, status: 'pending', groupId: null },
        { id: 'consolation-qf', eventId: 'c-plus-singles', roundIndex: 0, status: 'pending', groupId: null },
        { id: 'consolation-sf', eventId: 'c-plus-singles', roundIndex: 1, status: 'pending', groupId: null },
      ],
      [
        { matchId: 'salas-rivas-r16', entrantId: 'salas', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
        { matchId: 'salas-rivas-r16', entrantId: 'rivas', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
        {
          matchId: 'consolation-qf',
          entrantId: null,
          sourceKind: 'loserOf',
          sourceMatchId: 'salas-rivas-r16',
          sourceGroupId: null,
        },
        { matchId: 'consolation-qf', entrantId: null, sourceKind: 'bye', sourceMatchId: null, sourceGroupId: null },
        { matchId: 'consolation-sf', entrantId: 'rivas', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
        {
          matchId: 'consolation-sf',
          entrantId: null,
          sourceKind: 'winnerOf',
          sourceMatchId: 'consolation-qf',
          sourceGroupId: null,
        },
      ],
    );

    expect(matches.find((match) => match.id === 'consolation-qf')?.isBye).toBe(true);
    expect(matches.find((match) => match.id === 'consolation-sf')?.dependsOn).toEqual([
      'salas-rivas-r16',
    ]);

    const result = scheduleMatches(matches, {
      courtCount: 1,
      windows: [{ dayOfWeek: 5, startMinutes: 600, endMinutes: 960 }],
      matchMinutes: 60,
      startDate: '2026-11-20',
      maxDays: 1,
      minRestMinutes: 60,
    });
    const byId = new Map(result.scheduled.map((match) => [match.matchId, match]));
    const feeder = byId.get('salas-rivas-r16');
    const semifinal = byId.get('consolation-sf');

    expect(result.scheduled.map((match) => match.matchId)).toEqual([
      'salas-rivas-r16',
      'consolation-sf',
    ]);
    expect(byId.has('consolation-qf')).toBe(false);
    expect(feeder).toBeDefined();
    expect(semifinal).toBeDefined();
    expect(Date.parse(semifinal!.startsAt) - Date.parse(feeder!.endsAt)).toBeGreaterThanOrEqual(
      60 * 60 * 1000,
    );
  });

  it('waits for every group match feeding a group-rank slot', () => {
    const matches = adaptSchedulingMatches(
      [
        { id: 'group-one', eventId: 'hybrid', roundIndex: 0, status: 'pending', groupId: 'group-a' },
        { id: 'group-two', eventId: 'hybrid', roundIndex: 0, status: 'pending', groupId: 'group-a' },
        { id: 'playoff', eventId: 'hybrid', roundIndex: 1, status: 'pending', groupId: null },
      ],
      [
        { matchId: 'group-one', entrantId: 'a', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
        { matchId: 'group-one', entrantId: 'b', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
        { matchId: 'group-two', entrantId: 'b', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
        { matchId: 'group-two', entrantId: 'c', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
        {
          matchId: 'playoff',
          entrantId: null,
          sourceKind: 'groupRank',
          sourceMatchId: null,
          sourceGroupId: 'group-a',
        },
        { matchId: 'playoff', entrantId: 'd', sourceKind: null, sourceMatchId: null, sourceGroupId: null },
      ],
    );
    expect([...(matches.find((match) => match.id === 'playoff')?.dependsOn ?? [])].sort()).toEqual([
      'group-one',
      'group-two',
    ]);
  });
});
