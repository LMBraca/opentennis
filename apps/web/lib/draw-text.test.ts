import { describe, expect, it } from 'vitest';
import { dictionary, fill } from './i18n/dictionaries';
import { roundLabel, shortRoundRef, sourceText, stageSummary } from './draw-text';

const en = dictionary('en');
const es = dictionary('es');

describe('roundLabel', () => {
  it('translates the named rounds', () => {
    expect(roundLabel('Quarterfinal', es)).toBe('Cuartos de final');
    expect(roundLabel('Round of 16', es)).toBe('Octavos de final');
    expect(roundLabel('Semifinal', es)).toBe('Semifinal');
    expect(roundLabel('Final', es)).toBe('Final');
  });

  it('falls back to a plain round-of-N above the named ones', () => {
    expect(roundLabel('Round of 64', es)).toBe('Ronda de 64');
    expect(roundLabel('Round of 64', en)).toBe('Round of 64');
  });

  it('localizes indexed round-robin rounds', () => {
    expect(roundLabel('Round 1', es)).toBe('Ronda 1');
    expect(roundLabel('Round 2', en)).toBe('Round 2');
  });

  it('wraps a consolation round in the right order for each language', () => {
    // English puts the qualifier first, Spanish puts it last. A single
    // template with the word pasted on one end gets one of them wrong.
    expect(roundLabel('Consolation semifinal', es)).toBe('Semifinal de consolación');
    expect(roundLabel('Consolation semifinal', en)).toBe('Consolation semifinal');
    expect(roundLabel('Consolation quarterfinal', es)).toBe('Cuartos de final de consolación');
  });

  it('passes through a name it does not know rather than blanking it', () => {
    expect(roundLabel('Group stage', es)).toBe('Group stage');
  });
});

describe('shortRoundRef', () => {
  it('abbreviates and numbers from one', () => {
    expect(shortRoundRef('Semifinal', 0)).toBe('SF1');
    expect(shortRoundRef('Quarterfinal', 1)).toBe('QF2');
    expect(shortRoundRef('Final', null)).toBe('F');
  });

  it('hyphenates when the abbreviation ends in a digit', () => {
    // "R16" + slot 2 would otherwise read "R162".
    expect(shortRoundRef('Round of 16', 1)).toBe('R16-2');
  });

  it('uses the consolation round own numbering, not the main draw’s', () => {
    expect(shortRoundRef('Consolation semifinal', 0)).toBe('SF1');
  });
});

describe('sourceText', () => {
  it('names the feeding match in the reader’s language', () => {
    const source = { kind: 'winnerOf', round: 'Semifinal', slot: 0 } as const;
    expect(sourceText(source, en)).toBe('Winner of SF1');
    expect(sourceText(source, es)).toBe('Ganador de SF1');
  });

  it('handles a loser feed, which is how a consolation slot fills', () => {
    const source = { kind: 'loserOf', round: 'Quarterfinal', slot: 2 } as const;
    expect(sourceText(source, es)).toBe('Perdedor de QF3');
  });

  it('translates a bye', () => {
    expect(sourceText({ kind: 'bye' }, es)).toBe('Bye');
  });

  it('writes a group placing without a middle dot', () => {
    // The design system bans " · " joined meta strings as template chrome.
    const text = sourceText({ kind: 'groupRank', group: 'Grupo 2', rank: 1 }, es);
    expect(text).toBe('Grupo 2, 1.º');
    expect(text).not.toContain('·');
  });

  it('says what it can when the feeding round is unknown', () => {
    expect(sourceText({ kind: 'winnerOf', round: null, slot: null }, es)).toBe(
      'Ganador del partido anterior',
    );
  });

  it('is null for a slot with no source at all', () => {
    expect(sourceText(null, es)).toBeNull();
  });
});

describe('stageSummary', () => {
  const config = {
    seedingMode: 'partiallySeeded',
    bracketSize: 8,
    byeCount: 0,
    entrantCount: 8,
    seededCount: 4,
    description: '4 of 8 entrants seeded in an 8 bracket — no byes.',
  };

  it('rebuilds the sentence in Spanish rather than echoing the engine', () => {
    const text = stageSummary(config, es);
    expect(text).toBe('4 de 8 sembrados en un cuadro de 8 — sin byes.');
    expect(text).not.toContain('entrants');
  });

  it('rebuilds it in English too', () => {
    expect(stageSummary(config, en)).toBe('4 of 8 seeded in a draw of 8 — no byes.');
  });

  it('counts byes', () => {
    expect(stageSummary({ ...config, byeCount: 1, bracketSize: 16 }, es)).toContain('1 bye.');
    expect(stageSummary({ ...config, byeCount: 5, bracketSize: 16 }, es)).toContain('5 byes.');
  });

  it('distinguishes unseeded from fully seeded', () => {
    expect(stageSummary({ ...config, seedingMode: 'unseeded' }, es)).toContain('al azar');
    expect(stageSummary({ ...config, seedingMode: 'seeded' }, es)).toContain('totalmente sembrado');
  });

  // Unknown legacy sentence formats remain a last-resort fallback.
  it('rebuilds recognized legacy descriptions in the reader’s language', () => {
    expect(
      stageSummary(
        {
          description:
            'Unseeded random draw of 20 entrants in an 32 bracket — 12 byes assigned at random.',
        },
        es,
      ),
    ).toBe('Cuadro al azar sin cabezas de serie, 20 inscritos en un cuadro de 32 — 12 byes.');
  });

  it('leaves unrecognized legacy descriptions intact when counts are missing', () => {
    expect(stageSummary({ description: 'Old English sentence.' }, es)).toBe(
      'Old English sentence.',
    );
  });

  it('is null when there is nothing at all', () => {
    expect(stageSummary({}, es)).toBeNull();
    expect(stageSummary(null, es)).toBeNull();
  });
});

/*
 * The dictionary is handed WHOLE to client components (SiteNav,
 * DrawSwitcher). A function value anywhere in it makes the entire object
 * unserializable, which `next build` does not catch — every page 500s at
 * request time with "Functions cannot be passed directly to Client
 * Components". It has happened once; this is the guard.
 */
describe('dictionary serializability', () => {
  for (const locale of ['en', 'es'] as const) {
    it(`${locale} contains no functions`, () => {
      const dict = dictionary(locale) as unknown as Record<string, unknown>;
      const offenders = Object.entries(dict)
        .filter(([, value]) => typeof value === 'function')
        .map(([key]) => key);
      expect(offenders).toEqual([]);
    });

    it(`${locale} survives a JSON round trip unchanged`, () => {
      const dict = dictionary(locale);
      expect(JSON.parse(JSON.stringify(dict))).toEqual(dict);
    });
  }

  it('has the same keys in both languages', () => {
    expect(Object.keys(dictionary('es')).sort()).toEqual(Object.keys(dictionary('en')).sort());
  });

  it('keeps the approved recovery and courtside copy in both locales', () => {
    expect(es.notFoundTitle).toBe('No encontramos esta página');
    expect(en.notFoundTitle).toBe('We couldn’t find this page');
    expect(es.loginMismatch).toBe('Esos datos no coinciden con ninguna cuenta.');
    expect(en.loginMismatch).toBe('Those details did not match an account.');
    expect(es.scoreLinkInvalidBody).toBe(
      'Este enlace de marcador ya no funciona. Pide uno nuevo al organizador.',
    );
    expect(en.scoreLinkInvalidBody).toBe(
      'This scoring link does not work any more. Ask the organizer for a new one.',
    );
    expect(es.court).toBe('Cancha');
    expect(en.court).toBe('Cancha');
    expect(es.roundRobin).toBe('Todos contra todos');
    expect(fill(es.matchCountN, { n: '8' })).toBe('8 partidos');
    expect(fill(en.matchCountN, { n: '8' })).toBe('8 matches');
  });

  it('keeps the reported admin labels in both locales', () => {
    expect(es.roundRobin).toBe('Todos contra todos');
    expect(es.singleElim).toBe('Eliminación directa');
    expect(es.scheduled).toBe('programados');
    expect(es.entriesTitle).toBe('Inscripciones');
    expect(es.scorekeepersTitle).toBe('Anotadores');
    expect(es.scorekeeperExample).toBe('Marco, Cancha 1–2');
    expect(en.scorekeeperExample).toBe('Marco, Cancha 1–2');
    expect(es.matchesPlayed).toBe('{played} de {total} partidos jugados.');
  });

  it('leaves no unfilled placeholder in a rendered summary', () => {
    const text = stageSummary(
      { seedingMode: 'seeded', bracketSize: 16, byeCount: 3, entrantCount: 13, seededCount: 13 },
      dictionary('es'),
    );
    expect(text).not.toMatch(/[{}]/);
  });
});
