import { describe, expect, it } from 'vitest';
import {
  duplicateGroups,
  fold,
  fullPlayerName,
  isDevelopmentFixturePlayer,
  matchesQuery,
  nameKey,
  nameSortKey,
  type ComparablePlayer,
} from './player-name';

function player(
  id: string,
  firstName: string,
  lastName: string,
  email: string | null = null,
): ComparablePlayer {
  return { id, firstName, lastName, email };
}

describe('fold', () => {
  it('strips the accents a Mexican club actually types', () => {
    expect(fold('Hernández')).toBe('hernandez');
    expect(fold('MUÑOZ')).toBe('munoz');
    expect(fold('Peña')).toBe('pena');
  });

  it('lowercases and trims', () => {
    expect(fold('  Chen  ')).toBe('chen');
  });
});

describe('nameSortKey', () => {
  it('sorts an accented surname adjacent to its unaccented twin', () => {
    const keys = [
      nameSortKey('Hernández', 'Ana'),
      nameSortKey('Ibarra', 'Luis'),
      nameSortKey('Hernandez', 'Ana'),
    ].sort();
    // The two Hernandez spellings must land next to each other, not with
    // Ibarra between them.
    expect(keys[0]).toBe(keys[1]);
  });
});

describe('fullPlayerName', () => {
  it('keeps the complete name so entrants with the same last word remain distinct', () => {
    expect(fullPlayerName('QA Player', 'Test')).toBe('QA Player Test');
    expect(fullPlayerName('Another Player', 'Test')).toBe('Another Player Test');
  });
});

describe('isDevelopmentFixturePlayer', () => {
  it('matches confirmed fixture tokens without matching real club names', () => {
    expect(isDevelopmentFixturePlayer('Prueba', 'Uno1')).toBe(true);
    expect(isDevelopmentFixturePlayer('Nombre', 'Turnstile')).toBe(true);
    expect(isDevelopmentFixturePlayer('Diego', 'Villarreal')).toBe(false);
    expect(isDevelopmentFixturePlayer('Alejandro', 'Beltrán')).toBe(false);
  });
});

describe('nameKey', () => {
  it('collapses repeated whitespace', () => {
    expect(nameKey('De  La', 'Cruz')).toBe(nameKey('De La', 'Cruz'));
  });
});

describe('matchesQuery', () => {
  const ana = player('1', 'Ana', 'Hernández', 'ana@example.com');

  it('matches an unaccented query against an accented name', () => {
    expect(matchesQuery(ana, 'hernandez')).toBe(true);
  });

  it('matches in either name order', () => {
    expect(matchesQuery(ana, 'ana hernandez')).toBe(true);
    expect(matchesQuery(ana, 'hernandez ana')).toBe(true);
  });

  it('matches on a partial word', () => {
    expect(matchesQuery(ana, 'her')).toBe(true);
  });

  it('requires every term to appear', () => {
    expect(matchesQuery(ana, 'ana ibarra')).toBe(false);
  });

  it('matches on email', () => {
    expect(matchesQuery(ana, 'ana@example')).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(ana, '   ')).toBe(true);
  });
});

describe('duplicateGroups', () => {
  it('groups the same name spelled with and without an accent', () => {
    const groups = duplicateGroups([
      player('1', 'Ana', 'Hernández'),
      player('2', 'Luis', 'Ibarra'),
      player('3', 'Ana', 'Hernandez'),
    ]);
    expect(groups).toHaveLength(1);
    expect([...groups[0]!].sort()).toEqual(['1', '3']);
  });

  it('groups different names that share an email', () => {
    const groups = duplicateGroups([
      player('1', 'Ana', 'Hernández', 'ana@example.com'),
      player('2', 'Ana María', 'Hernández', 'ANA@example.com'),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('chains a name match and an email match into one person', () => {
    // A shares a name with B; B shares an email with C. One person, thrice.
    const groups = duplicateGroups([
      player('1', 'Ana', 'Hernandez', null),
      player('2', 'Ana', 'Hernández', 'ana@example.com'),
      player('3', 'A', 'Hernandez', 'ana@example.com'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('does NOT group people who merely share a surname', () => {
    // The conservative rule: adjacency in the sorted list is how a human
    // spots these, not an automatic flag.
    expect(
      duplicateGroups([
        player('1', 'Ana', 'Hernández'),
        player('2', 'Luis', 'Hernández'),
      ]),
    ).toHaveLength(0);
  });

  it('does not group on a shared empty email', () => {
    expect(
      duplicateGroups([
        player('1', 'Ana', 'Hernández', ''),
        player('2', 'Luis', 'Ibarra', null),
      ]),
    ).toHaveLength(0);
  });

  it('returns nothing when everyone is distinct', () => {
    expect(
      duplicateGroups([player('1', 'Ana', 'Hernández'), player('2', 'Luis', 'Ibarra')]),
    ).toHaveLength(0);
  });
});

describe('duplicateGroups — contradicting emails', () => {
  it('does NOT group two people with the same name but different emails', () => {
    // Two different addresses is the person telling you they are two people.
    expect(
      duplicateGroups([
        player('1', 'Luca', 'Rossi', 'luca.rossi.69@example.test'),
        player('2', 'Luca', 'Rossi', 'luca.rossi.21@example.test'),
      ]),
    ).toHaveLength(0);
  });

  it('still groups a same-name pair when one has no email', () => {
    const groups = duplicateGroups([
      player('1', 'Luca', 'Rossi', 'luca@example.test'),
      player('2', 'Luca', 'Rossi', null),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('keeps three same-name people apart when all three emails differ', () => {
    expect(
      duplicateGroups([
        player('1', 'Luca', 'Rossi', 'a@example.test'),
        player('2', 'Luca', 'Rossi', 'b@example.test'),
        player('3', 'Luca', 'Rossi', 'c@example.test'),
      ]),
    ).toHaveLength(0);
  });

  it('groups on a shared email even when the names differ', () => {
    expect(
      duplicateGroups([
        player('1', 'Luca', 'Rossi', 'same@example.test'),
        player('2', 'L', 'Rossi', 'same@example.test'),
      ]),
    ).toHaveLength(1);
  });
});
