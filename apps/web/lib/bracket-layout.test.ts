import { describe, expect, it } from 'vitest';
import { DEFAULT_GEOMETRY } from '@opentennis/engine';
import {
  bracketLayout,
  mainRounds,
  thirdPlaceRound,
  withoutConsolationPrefix,
} from './bracket-layout';
import type { DrawRound } from './queries';

/**
 * A generated single-elimination draw of `size` entrants: log2(size) rounds,
 * halving each time. Enough structure for the geometry, which is all this
 * module cares about.
 */
function elimination(size: number): DrawRound[] {
  const rounds: DrawRound[] = [];
  let matchesInRound = size / 2;
  let roundIndex = 0;
  while (matchesInRound >= 1) {
    rounds.push({
      id: `round-${roundIndex}`,
      name: matchesInRound === 1 ? 'Final' : `Round of ${matchesInRound * 2}`,
      roundIndex,
      kind: 'main',
      groupId: null,
      matches: Array.from({ length: matchesInRound }, (_, slotIndex) => ({
        id: `m-${roundIndex}-${slotIndex}`,
        engineMatchId: `r${roundIndex}m${slotIndex}`,
        slotIndex,
        status: 'pending',
        outcome: null,
        winnerEntrantId: null,
        sides: [
          { position: 0, entrantId: null, name: null, seed: null, source: null },
          { position: 1, entrantId: null, name: null, seed: null, source: null },
        ],
        sets: [],
      })),
    });
    matchesInRound /= 2;
    roundIndex += 1;
  }
  return rounds;
}

function thirdPlaceFor(roundIndex: number): DrawRound {
  return {
    id: 'round-3p',
    name: 'Third place',
    roundIndex,
    kind: 'thirdPlace',
    groupId: null,
    matches: [
      {
        id: 'm-3p',
        engineMatchId: 'p0m0',
        slotIndex: 0,
        status: 'pending',
        outcome: null,
        winnerEntrantId: null,
        sides: [
          { position: 0, entrantId: null, name: null, seed: null, source: null },
          { position: 1, entrantId: null, name: null, seed: null, source: null },
        ],
        sets: [],
      },
    ],
  };
}

describe('mainRounds / thirdPlaceRound', () => {
  it('separates the playoff from the elimination chain', () => {
    const rounds = [...elimination(8), thirdPlaceFor(3)];
    expect(mainRounds(rounds)).toHaveLength(3);
    expect(thirdPlaceRound(rounds)?.kind).toBe('thirdPlace');
  });

  it('reports no playoff when there is none', () => {
    expect(thirdPlaceRound(elimination(8))).toBeUndefined();
  });
});

describe('bracketLayout', () => {
  it('places one node per match', () => {
    const layout = bracketLayout(elimination(16));
    // 8 + 4 + 2 + 1
    expect(layout.nodes).toHaveLength(15);
  });

  it('keeps the 32-draw Final within the full desktop canvas width', () => {
    const layout = bracketLayout(elimination(32));
    const final = layout.nodes.find((node) => node.roundIndex === 4);

    expect(final).toBeDefined();
    expect(final!.x + final!.width).toBe(layout.width);
    expect(layout.width).toBe(5 * DEFAULT_GEOMETRY.nodeWidth + 4 * DEFAULT_GEOMETRY.columnGap);
  });

  it('gives every round its own column', () => {
    const layout = bracketLayout(elimination(16));
    const columns = new Set(layout.nodes.map((n) => n.x));
    expect(columns.size).toBe(4);
  });

  it('connects every match after the first round to its two feeders', () => {
    const layout = bracketLayout(elimination(8));
    // Rounds 1 and 2 hold 2 + 1 matches, each fed by two children.
    expect(layout.connectors).toHaveLength(6);
    for (const connector of layout.connectors) {
      expect(connector.fromMatchId).not.toBe(connector.toMatchId);
      expect(connector.length).toBeGreaterThan(0);
    }
  });

  it('honours a custom geometry, which is how the printed sheet differs', () => {
    const sheet = { nodeWidth: 200, nodeHeight: 40, verticalGap: 4, columnGap: 28 };
    const layout = bracketLayout(elimination(8), sheet);
    expect(layout.width).toBe(3 * 200 + 2 * 28);
    expect(layout.height).toBe((40 + 4) * 4);
    for (const node of layout.nodes) {
      expect(node.width).toBe(200);
      expect(node.height).toBe(40);
    }
  });

  it('defaults to the on-screen geometry', () => {
    const layout = bracketLayout(elimination(8));
    expect(layout.options).toEqual(DEFAULT_GEOMETRY);
  });

  it('ignores a third-place round, which carries no connectors', () => {
    const withPlayoff = bracketLayout([...elimination(8), thirdPlaceFor(3)]);
    const without = bracketLayout(elimination(8));
    expect(withPlayoff.nodes).toHaveLength(without.nodes.length);
    expect(withPlayoff.height).toBe(without.height);
  });

  it('keeps a bye match in the layout so its parent still has a connector', () => {
    // A bye's winner is pre-resolved in storage; parents are wired from slot
    // arithmetic precisely so the connector does not vanish.
    const base = elimination(8);
    const first = base[0]!;
    const rounds: DrawRound[] = [
      { ...first, matches: first.matches.map((m, i) => (i === 0 ? { ...m, status: 'bye' } : m)) },
      ...base.slice(1),
    ];
    const layout = bracketLayout(rounds);
    expect(layout.connectors.some((c) => c.fromMatchId === 'r0m0')).toBe(true);
  });
});

describe('withoutConsolationPrefix', () => {
  const named = (names: readonly string[]): DrawRound[] =>
    names.map((name, roundIndex) => ({
      id: `r${roundIndex}`,
      name,
      roundIndex,
      kind: 'main',
      groupId: null,
      matches: [],
    }));

  it('strips the prefix and re-capitalises what is left', () => {
    const out = withoutConsolationPrefix(
      named(['Consolation quarterfinal', 'Consolation semifinal', 'Consolation final']),
    );
    expect(out.map((r) => r.name)).toEqual(['Quarterfinal', 'Semifinal', 'Final']);
  });

  it('handles the round-of-N form', () => {
    expect(withoutConsolationPrefix(named(['Consolation round of 16']))[0]?.name).toBe(
      'Round of 16',
    );
  });

  it('leaves main-draw round names untouched', () => {
    const rounds = named(['Quarterfinal', 'Semifinal', 'Final']);
    expect(withoutConsolationPrefix(rounds).map((r) => r.name)).toEqual([
      'Quarterfinal',
      'Semifinal',
      'Final',
    ]);
  });

  /*
   * The prefix only ever comes off for display. A name that merely starts
   * with the word, were one ever to exist, must not lose its first letter.
   */
  it('changes nothing but the name', () => {
    const [before] = named(['Consolation final']);
    const [after] = withoutConsolationPrefix([before!]);
    expect({ ...after, name: '' }).toEqual({ ...before!, name: '' });
  });
});
