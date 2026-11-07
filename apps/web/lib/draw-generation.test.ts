import { describe, expect, it } from 'vitest';
import { drawResultSnapshot, isBulkDrawEligible } from './draw-generation';

describe('isBulkDrawEligible', () => {
  it('matches the event statuses selected by bulk generation', () => {
    expect(['draft', 'ready', 'published'].every(isBulkDrawEligible)).toBe(true);
    expect(['inProgress', 'complete', 'notRun'].some(isBulkDrawEligible)).toBe(false);
  });

  describe('drawResultSnapshot', () => {
    it('sorts event counts and excludes events without results', () => {
      expect(
        drawResultSnapshot([
          ['event-b', 1],
          ['event-a', 0],
          ['event-c', 2],
        ]),
      ).toBe('event-b:1|event-c:2');
    });
  });
});
