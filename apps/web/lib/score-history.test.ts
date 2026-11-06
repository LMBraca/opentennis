import { describe, expect, it } from 'vitest';
import { canUndo, parseResultPayload, planUndo, type ScoreEventRow } from './score-history';

let clock = 0;
function event(
  id: string,
  kind: string,
  payload: unknown,
  revertedByEventId: string | null = null,
): ScoreEventRow {
  clock += 1000;
  return { id, kind, payload, createdAt: new Date(clock), revertedByEventId };
}

function result(winner: 0 | 1, ...games: Array<[number, number]>) {
  return {
    outcome: 'completed',
    winner,
    sets: games.map(([a, b], setIndex) => ({
      setIndex,
      side0Games: a,
      side1Games: b,
      side0TiebreakPoints: null,
      side1TiebreakPoints: null,
    })),
  };
}

describe('parseResultPayload', () => {
  it('reads a well-formed result', () => {
    const payload = result(0, [6, 3], [6, 4]);
    expect(parseResultPayload(payload)?.sets).toHaveLength(2);
    expect(parseResultPayload(payload)?.winner).toBe(0);
  });

  it('keeps tiebreak points, including a legitimate null', () => {
    const parsed = parseResultPayload({
      outcome: 'completed',
      winner: 1,
      sets: [
        {
          setIndex: 0,
          side0Games: 6,
          side1Games: 7,
          side0TiebreakPoints: 5,
          side1TiebreakPoints: 7,
        },
      ],
    });
    expect(parsed?.sets[0]?.side1TiebreakPoints).toBe(7);
  });

  it('rejects a winner that is not a side position', () => {
    expect(parseResultPayload({ ...result(0), winner: 2 })).toBeNull();
    expect(parseResultPayload({ ...result(0), winner: 'alvarez' })).toBeNull();
  });

  it('rejects junk rather than restoring a half-remembered match', () => {
    for (const bad of [null, undefined, 'result', 7, [], {}]) {
      expect(parseResultPayload(bad)).toBeNull();
    }
  });

  it('rejects a set with non-integer games', () => {
    expect(
      parseResultPayload({
        outcome: 'completed',
        winner: 0,
        sets: [{ setIndex: 0, side0Games: 6.5, side1Games: 3 }],
      }),
    ).toBeNull();
  });
});

describe('planUndo', () => {
  it('is null when nothing has happened', () => {
    expect(planUndo([])).toBeNull();
  });

  it('takes the only result back to no result at all', () => {
    const plan = planUndo([event('e1', 'result', result(0, [6, 3], [6, 4]))]);
    expect(plan?.undoing.id).toBe('e1');
    expect(plan?.restoreTo).toBeNull();
  });

  it('steps a correction back to the score it replaced', () => {
    const plan = planUndo([
      event('e1', 'result', result(0, [6, 3], [6, 4])),
      event('e2', 'result', result(1, [6, 3], [4, 6], [2, 6])),
    ]);
    expect(plan?.undoing.id).toBe('e2');
    expect(plan?.restoreTo?.winner).toBe(0);
    expect(plan?.restoreTo?.sets).toHaveLength(2);
  });

  it('undoing a clear brings the result back', () => {
    // This is the case clearResult could never offer: the score is not gone,
    // only superseded.
    const plan = planUndo([
      event('e1', 'result', result(0, [6, 3], [6, 4])),
      event('e2', 'clear', {}),
    ]);
    expect(plan?.undoing.kind).toBe('clear');
    expect(plan?.restoreTo?.winner).toBe(0);
  });

  it('walks back a SECOND step instead of restoring what it just restored', () => {
    // The bug this is here for: targeting the `undo` row made every press
    // after the first a silent no-op, because the state behind an undo is
    // the state that undo had just produced.
    const first = planUndo([
      event('e1', 'result', result(0, [6, 1])),
      event('e2', 'result', result(1, [1, 6])),
    ]);
    expect(first?.undoing.id).toBe('e2');

    // e2 now reverted by the undo row e3.
    const second = planUndo([
      event('e1', 'result', result(0, [6, 1])),
      event('e2', 'result', result(1, [1, 6]), 'e3'),
      event('e3', 'undo', {}),
    ]);
    expect(second?.undoing.id).toBe('e1');
    expect(second?.restoreTo).toBeNull();
  });

  it('does not treat an undo row as something to undo', () => {
    expect(planUndo([event('e1', 'undo', {})])).toBeNull();
  });

  it('skips events that were already reverted, so undo walks backwards', () => {
    const plan = planUndo([
      event('e1', 'result', result(0, [6, 3], [6, 4])),
      event('e2', 'result', result(1, [1, 6], [2, 6]), 'e3'),
      event('e3', 'undo', {}, null),
    ]);
    // e2 is spent and e3 is bookkeeping, so the live tail is e1 itself.
    expect(plan?.undoing.id).toBe('e1');
    expect(plan?.restoreTo).toBeNull();
  });

  it('ignores a result whose payload cannot be read', () => {
    const plan = planUndo([
      event('e1', 'result', result(1, [6, 0])),
      event('e2', 'result', { outcome: 'completed' }), // malformed
      event('e3', 'clear', {}),
    ]);
    expect(plan?.undoing.id).toBe('e3');
    expect(plan?.restoreTo?.winner).toBe(1);
  });

  it('orders by time, not by the order rows came back', () => {
    const a = event('e1', 'result', result(0, [6, 1]));
    const b = event('e2', 'result', result(1, [1, 6]));
    expect(planUndo([b, a])?.undoing.id).toBe('e2');
  });
});

describe('canUndo', () => {
  it('is false with no events', () => {
    expect(canUndo([])).toBe(false);
  });

  it('is false once every event has been reverted', () => {
    expect(canUndo([event('e1', 'result', result(0, [6, 0]), 'e2')])).toBe(false);
  });

  it('is false when only undo bookkeeping remains', () => {
    expect(canUndo([event('e1', 'result', result(0, [6, 0]), 'e2'), event('e2', 'undo', {})])).toBe(
      false,
    );
  });

  it('is true while a live event remains', () => {
    expect(canUndo([event('e1', 'result', result(0, [6, 0]))])).toBe(true);
  });
});
