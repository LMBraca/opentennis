/**
 * These tests are about the cases an organizer actually hits at a desk with
 * people waiting: a half-typed score, a retirement, a walkover with a score
 * still in the boxes. The engine's own suite covers whether 7-6 is a legal
 * set; this covers whether the form can produce a wrong match.
 */

import { describe, expect, it } from 'vitest';
import { BEST_OF_3, BEST_OF_3_MATCH_TIEBREAK, PRO_SET_8, FAST4 } from '@opentennis/engine';
import {
  decide,
  matchingPresetName,
  maxSets,
  parseScoringOverride,
  parseSets,
  resolveScoringFormat,
  scoringFormatFor,
} from './match-result';

/** A tiny stand-in for FormData. */
const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe('scoringFormatFor', () => {
  it('maps the stored columns onto the engine format', () => {
    expect(
      scoringFormatFor({
        setsToWin: 2,
        gamesPerSet: 6,
        tiebreakAt: 6,
        tiebreakTo: 7,
        decidingSetMode: 'standard',
        adScoring: true,
      }),
    ).toEqual(BEST_OF_3);
  });

  it('reads a match-tiebreak decider', () => {
    const f = scoringFormatFor({
      setsToWin: 2,
      gamesPerSet: 6,
      tiebreakAt: 6,
      tiebreakTo: 7,
      decidingSetMode: 'matchTiebreak',
      adScoring: true,
    });
    expect(f.decidingSetMode).toBe('matchTiebreak');
    expect(f).toEqual(BEST_OF_3_MATCH_TIEBREAK);
  });

  it('treats an unrecognised deciding mode as standard rather than throwing', () => {
    // The column is plain text. A bad value must not take down score entry
    // in the middle of a tournament.
    const f = scoringFormatFor({
      setsToWin: 2,
      gamesPerSet: 6,
      tiebreakAt: 6,
      tiebreakTo: 7,
      decidingSetMode: 'nonsense',
      adScoring: true,
    });
    expect(f.decidingSetMode).toBe('standard');
  });

  it('carries a null tiebreakAt through as an advantage set', () => {
    const f = scoringFormatFor({
      setsToWin: 1,
      gamesPerSet: 6,
      tiebreakAt: null,
      tiebreakTo: 7,
      decidingSetMode: 'standard',
      adScoring: true,
    });
    expect(f.tiebreakAt).toBeNull();
  });
});

describe('maxSets', () => {
  it('is 3 for best of 3 and 1 for a pro set', () => {
    expect(maxSets(BEST_OF_3)).toBe(3);
    expect(maxSets(PRO_SET_8)).toBe(1);
  });
});

describe('parseSets', () => {
  it('reads straight sets and ignores the unplayed third', () => {
    const { sets, error } = parseSets(form({ set0_0: '6', set0_1: '4', set1_0: '6', set1_1: '2' }), BEST_OF_3);
    expect(error).toBeUndefined();
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ setIndex: 0, side0Games: 6, side1Games: 4 });
  });

  it('keeps tiebreak points with their set', () => {
    const { sets } = parseSets(
      form({ set0_0: '7', set0_1: '6', tb0_0: '7', tb0_1: '5' }),
      BEST_OF_3,
    );
    expect(sets[0]).toMatchObject({ side0TiebreakPoints: 7, side1TiebreakPoints: 5 });
  });

  it('REJECTS a half-typed set', () => {
    // The dangerous case: dropping it silently records a different match.
    const { error } = parseSets(form({ set0_0: '6' }), BEST_OF_3);
    expect(error).toMatch(/both games/);
  });

  it('rejects a gap between sets', () => {
    const { error } = parseSets(
      form({ set0_0: '6', set0_1: '4', set2_0: '6', set2_1: '3' }),
      BEST_OF_3,
    );
    expect(error).toMatch(/blank but a later set/);
  });

  it('rejects non-numeric games', () => {
    expect(parseSets(form({ set0_0: 'six', set0_1: '4' }), BEST_OF_3).error).toMatch(/whole numbers/);
  });

  it('returns nothing for an empty form', () => {
    expect(parseSets(form({}), BEST_OF_3)).toEqual({ sets: [] });
  });

  it('only reads as many sets as the format can have', () => {
    // A pro set is one set. A stray set1 must not sneak in.
    const { sets } = parseSets(
      form({ set0_0: '8', set0_1: '6', set1_0: '6', set1_1: '0' }),
      PRO_SET_8,
    );
    expect(sets).toHaveLength(1);
  });
});

describe('decide — completed', () => {
  const won = [
    { side0Games: 6, side1Games: 4 },
    { side0Games: 6, side1Games: 2 },
  ];

  it('names the winner of a finished match', () => {
    const r = decide(won, BEST_OF_3, 'completed', null);
    expect(r).toMatchObject({ winner: 0 });
  });

  it('refuses a score that does not finish the match', () => {
    const r = decide(
      [
        { side0Games: 6, side1Games: 4 },
        { side0Games: 3, side1Games: 6 },
      ],
      BEST_OF_3,
      'completed',
      null,
    );
    expect(r).toHaveProperty('error');
  });

  it('refuses an empty score', () => {
    expect(decide([], BEST_OF_3, 'completed', null)).toHaveProperty('error');
  });

  it('refuses an illegal set even when it looks decisive', () => {
    // 5-3 cannot end a standard set; the engine knows, so this must not pass.
    const r = decide(
      [
        { side0Games: 5, side1Games: 3 },
        { side0Games: 5, side1Games: 3 },
      ],
      BEST_OF_3,
      'completed',
      null,
    );
    expect(r).toHaveProperty('error');
  });

  it('honours a Fast4 set that would be illegal under standard rules', () => {
    const r = decide([{ side0Games: 4, side1Games: 2 }], { ...FAST4, setsToWin: 1 }, 'completed', null);
    expect(r).toMatchObject({ winner: 0 });
  });
});

describe('decide — non-standard outcomes', () => {
  it('accepts a retirement with a partial score and an awarded side', () => {
    const r = decide(
      [{ side0Games: 6, side1Games: 4 }, { side0Games: 2, side1Games: 1 }],
      BEST_OF_3,
      'retirement',
      0,
    );
    expect(r).toMatchObject({ winner: 0 });
  });

  it('refuses a retirement with nobody named', () => {
    // The score cannot say who carried on, so it has to be stated.
    const r = decide([{ side0Games: 2, side1Games: 1 }], BEST_OF_3, 'retirement', null);
    expect(r).toHaveProperty('error');
  });

  it('accepts a walkover with no score', () => {
    expect(decide([], BEST_OF_3, 'walkover', 1)).toMatchObject({ winner: 1 });
  });

  it('REFUSES a walkover that still has a score in the boxes', () => {
    // Nobody played, so a score is a contradiction. Storing it quietly would
    // feed games-percentage tiebreakers with a match that never happened.
    const r = decide([{ side0Games: 6, side1Games: 0 }], BEST_OF_3, 'walkover', 1);
    expect(r).toHaveProperty('error');
  });

  it('refuses a default with a score', () => {
    expect(decide([{ side0Games: 6, side1Games: 0 }], BEST_OF_3, 'default', 0)).toHaveProperty('error');
  });

  it('refuses a walkover with nobody named', () => {
    expect(decide([], BEST_OF_3, 'walkover', null)).toHaveProperty('error');
  });
});

describe('parseScoringOverride', () => {
  const valid = {
    setsToWin: 2,
    gamesPerSet: 6,
    tiebreakAt: 6,
    tiebreakTo: 7,
    decidingSetMode: 'standard',
    adScoring: true,
  };

  it('accepts a well-formed override', () => {
    expect(parseScoringOverride(valid)).toEqual(valid);
  });

  it('treats a null tiebreakAt as an advantage set, not as missing', () => {
    const adv = { ...valid, tiebreakAt: null };
    expect(parseScoringOverride(adv)?.tiebreakAt).toBeNull();
  });

  it('rejects a tiebreakAt above gamesPerSet, which could never be reached', () => {
    expect(parseScoringOverride({ ...valid, tiebreakAt: 9 })).toBeNull();
  });

  it('rejects a match tiebreak in a one-set format, which has no deciding set', () => {
    expect(
      parseScoringOverride({ ...valid, setsToWin: 1, decidingSetMode: 'matchTiebreak' }),
    ).toBeNull();
  });

  it('rejects junk rather than throwing at a courtside save', () => {
    for (const bad of [null, undefined, 'bestOf3', 42, [], {}, { setsToWin: 2 }]) {
      expect(parseScoringOverride(bad)).toBeNull();
    }
  });

  it('rejects a missing tiebreakAt key, which is not the same as null', () => {
    const withoutKey: Record<string, unknown> = { ...valid };
    delete withoutKey['tiebreakAt'];
    expect(parseScoringOverride(withoutKey)).toBeNull();
  });

  it('rejects non-integer games', () => {
    expect(parseScoringOverride({ ...valid, gamesPerSet: 6.5 })).toBeNull();
  });
});

describe('resolveScoringFormat', () => {
  const event = {
    setsToWin: 1,
    gamesPerSet: 8,
    tiebreakAt: 8,
    tiebreakTo: 7,
    decidingSetMode: 'standard',
    adScoring: true,
  };

  it('uses the draw format when the round has no override', () => {
    expect(resolveScoringFormat(event, null).gamesPerSet).toBe(8);
  });

  it('lets a round override the draw — the final played best of 3', () => {
    const final = {
      setsToWin: 2,
      gamesPerSet: 6,
      tiebreakAt: 6,
      tiebreakTo: 7,
      decidingSetMode: 'standard',
      adScoring: true,
    };
    const resolved = resolveScoringFormat(event, final);
    expect(resolved.setsToWin).toBe(2);
    expect(resolved.gamesPerSet).toBe(6);
  });

  it('falls back to the draw when the stored override is unusable', () => {
    // A malformed override must never take a courtside save down with it.
    expect(resolveScoringFormat(event, { setsToWin: 'two' }).gamesPerSet).toBe(8);
  });
});

describe('matchingPresetName', () => {
  it('names the default the schema ships with', () => {
    expect(
      matchingPresetName({
        setsToWin: 2,
        gamesPerSet: 6,
        tiebreakAt: 6,
        tiebreakTo: 7,
        decidingSetMode: 'standard',
        adScoring: true,
      }),
    ).toBe('bestOf3');
  });

  it('distinguishes a pro set from a single set to 6', () => {
    const base = { setsToWin: 1, tiebreakTo: 7, decidingSetMode: 'standard' as const, adScoring: true };
    expect(matchingPresetName({ ...base, gamesPerSet: 8, tiebreakAt: 8 })).toBe('proSet8');
    expect(matchingPresetName({ ...base, gamesPerSet: 6, tiebreakAt: 6 })).toBe('singleSet6');
  });

  it('names advantage sets, where the tiebreak is null', () => {
    expect(
      matchingPresetName({
        setsToWin: 2,
        gamesPerSet: 6,
        tiebreakAt: null,
        tiebreakTo: 7,
        decidingSetMode: 'standard',
        adScoring: true,
      }),
    ).toBe('advantageBestOf3');
  });

  it('returns null for a format no preset covers, rather than the nearest one', () => {
    expect(
      matchingPresetName({
        setsToWin: 2,
        gamesPerSet: 9,
        tiebreakAt: 9,
        tiebreakTo: 7,
        decidingSetMode: 'standard',
        adScoring: true,
      }),
    ).toBeNull();
  });
});
