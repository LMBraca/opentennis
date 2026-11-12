import { describe, expect, it } from 'vitest';
import { groupIntoDraws } from './draw-grouping';

const m = (drawLabel: string, roundIndex: number, slotIndex: number) => ({
  drawLabel,
  roundIndex,
  slotIndex,
  id: `${drawLabel}-${roundIndex}-${slotIndex}`,
});

describe('groupIntoDraws', () => {
  it('splits by draw and keeps first-appearance order', () => {
    // Ladder order, not alphabetical: C+ must not sort above Open.
    const out = groupIntoDraws([m('Open Singles', 0, 0), m('C+ Singles', 0, 0)]);
    expect(out.map((d) => d.label)).toEqual(['Open Singles', 'C+ Singles']);
  });

  it('orders columns by round even when the input is shuffled', () => {
    const out = groupIntoDraws([m('A', 2, 0), m('A', 0, 0), m('A', 1, 0)]);
    expect(out[0]?.columns.map((c) => c.roundIndex)).toEqual([0, 1, 2]);
  });

  it('orders matches within a column by slot', () => {
    const out = groupIntoDraws([m('A', 0, 3), m('A', 0, 1), m('A', 0, 2), m('A', 0, 0)]);
    expect(out[0]?.columns[0]?.matches.map((x) => x.slotIndex)).toEqual([0, 1, 2, 3]);
  });

  it('keeps draws apart that share round and slot numbers', () => {
    const out = groupIntoDraws([m('A', 0, 0), m('B', 0, 0)]);
    expect(out).toHaveLength(2);
    expect(out[0]?.columns[0]?.matches).toHaveLength(1);
  });

  it('keeps consolation rounds out of the main draw columns', () => {
    const mainQuarterfinal = m('Open Singles', 1, 0);
    const consolationFinal = m('Open Singles — Consolation', 1, 0);
    const out = groupIntoDraws([consolationFinal, mainQuarterfinal]);

    expect(out.map((draw) => draw.label)).toEqual([
      'Open Singles — Consolation',
      'Open Singles',
    ]);
    expect(out.map((draw) => draw.columns.map((column) => column.matches))).toEqual([
      [[consolationFinal]],
      [[mainQuarterfinal]],
    ]);
  });

  it('returns nothing for no matches', () => {
    expect(groupIntoDraws([])).toEqual([]);
  });
});
