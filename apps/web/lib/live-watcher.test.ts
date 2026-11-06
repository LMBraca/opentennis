import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatVersion, subscribe, watchedCount } from './live-watcher';

describe('formatVersion', () => {
  it('changes when a score event is added', () => {
    const before = formatVersion(31, 4, new Date('2026-11-05T18:00:00Z'));
    const after = formatVersion(31, 5, new Date('2026-11-05T18:01:00Z'));
    expect(before).not.toBe(after);
  });

  it('changes when a draw is regenerated, even with no scores', () => {
    expect(formatVersion(31, 0, null)).not.toBe(formatVersion(63, 0, null));
  });

  it('is stable for unchanged data, so no spurious refresh is pushed', () => {
    const at = new Date('2026-11-05T18:00:00Z');
    expect(formatVersion(31, 4, at)).toBe(formatVersion(31, 4, at));
  });

  it('normalises an equivalent timestamp given as a string', () => {
    // The driver may hand back either, and a type difference must not look
    // like a change — that would refresh every spectator every 2 seconds.
    expect(formatVersion(1, 1, '2026-11-05T18:00:00.000Z')).toBe(
      formatVersion(1, 1, new Date('2026-11-05T18:00:00.000Z')),
    );
  });

  it('handles a tournament with no score events yet', () => {
    expect(formatVersion(31, 0, null)).toBe('31:0:-');
  });
});

describe('subscribe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts watching on the first subscriber and stops on the last', () => {
    expect(watchedCount()).toBe(0);
    const off = subscribe('t1', () => {});
    expect(watchedCount()).toBe(1);
    off();
    expect(watchedCount()).toBe(0);
  });

  it('shares ONE watcher between spectators on the same tournament', () => {
    const a = subscribe('t2', () => {});
    const b = subscribe('t2', () => {});
    expect(watchedCount()).toBe(1);

    // One leaving must not stop the poller for the other.
    a();
    expect(watchedCount()).toBe(1);
    b();
    expect(watchedCount()).toBe(0);
  });

  it('watches different tournaments independently', () => {
    const a = subscribe('t3', () => {});
    const b = subscribe('t4', () => {});
    expect(watchedCount()).toBe(2);
    a();
    expect(watchedCount()).toBe(1);
    b();
    expect(watchedCount()).toBe(0);
  });

  it('is safe to unsubscribe twice', () => {
    const off = subscribe('t5', () => {});
    off();
    off();
    expect(watchedCount()).toBe(0);
  });
});
