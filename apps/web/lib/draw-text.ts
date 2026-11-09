/**
 * Turning stored draw data into words the reader's language uses.
 *
 * Round names are STORED in English. `rounds.name` is the key the scores
 * queue, the order of play, the scorekeeper page and the CSV export all
 * share, and it is what `scoring_override` is matched against — translating
 * it in the database would mean a Spanish draw and an English draw could not
 * be queried the same way. So English is the canonical spelling and this
 * module is the one place it becomes "Cuartos de final".
 *
 * Everything here is a pure function of (stored value, dictionary). No I/O,
 * no locale detection — the caller already knows the locale.
 */

import type { Dictionary } from './i18n/dictionaries';

const CONSOLATION_PREFIX = 'Consolation ';

/**
 * Fill `{name}` placeholders in a dictionary template.
 *
 * The dictionary holds TEMPLATES, never functions: the whole object is
 * handed to client components, and one function anywhere in it makes the
 * entire thing unserializable — which the build does not catch and which
 * 500s every page at request time.
 */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** English needs four ordinal forms, Spanish one. */
function ordinal(n: number, dict: Dictionary): string {
  if (n === 1) return dict.ordinal1;
  if (n === 2) return dict.ordinal2;
  if (n === 3) return dict.ordinal3;
  return fill(dict.ordinalN, { n });
}

/**
 * "Quarterfinal" -> "Cuartos de final". "Consolation semifinal" ->
 * "Semifinal de consolación".
 *
 * An unrecognised name is returned unchanged rather than dropped. Round
 * names come from the engine, but a hybrid stage or a hand-edited row could
 * carry something this does not know, and showing it is better than showing
 * a blank column header.
 */
export function roundLabel(name: string, dict: Dictionary): string {
  if (name.startsWith(CONSOLATION_PREFIX)) {
    const base = name.slice(CONSOLATION_PREFIX.length);
    // Re-capitalise before the lookup: the engine lowercases the first
    // letter when it prefixes, so the stored form is "Consolation semifinal".
    const restored = `${base.charAt(0).toUpperCase()}${base.slice(1)}`;
    const inner = roundLabel(restored, dict);
    /*
     * Capitalisation follows POSITION, which is the actual rule in both
     * languages: Spanish reads "Semifinal de consolación" with the round
     * first, English "Consolation semifinal" with it second, and a word
     * mid-phrase is lower case.
     */
    const leads = dict.roundConsolation.startsWith('{round}');
    const cased = leads
      ? `${inner.charAt(0).toUpperCase()}${inner.slice(1)}`
      : `${inner.charAt(0).toLowerCase()}${inner.slice(1)}`;
    return fill(dict.roundConsolation, { round: cased });
  }

  if (name === 'Final') return dict.roundFinal;
  if (name === 'Semifinal') return dict.roundSemifinal;
  if (name === 'Quarterfinal') return dict.roundQuarterfinal;

  const roundOf = /^Round of (\d+)$/.exec(name);
  if (roundOf !== null) {
    const n = Number(roundOf[1]);
    return n === 16 ? dict.roundOf16 : fill(dict.roundOfN, { n });
  }

  const indexedRound = /^Round (\d+)$/.exec(name);
  if (indexedRound !== null) return fill(dict.roundIndexed, { n: Number(indexedRound[1]) });

  return name;
}

/**
 * The short form used inside a slot placeholder: "SF1", "QF2", "R16-3".
 *
 * Deliberately NOT translated. These are column coordinates, not prose —
 * "Ganador de CF2" asks a Spanish reader to decode an abbreviation that only
 * exists on this page, where "QF2" matches what is printed on the draw
 * sheet beside it. The verb around it carries the language.
 */
export function shortRoundRef(name: string, slot: number | null): string {
  const bare = name.startsWith(CONSOLATION_PREFIX)
    ? `${name.charAt(CONSOLATION_PREFIX.length).toUpperCase()}${name.slice(CONSOLATION_PREFIX.length + 1)}`
    : name;

  const short =
    bare === 'Final'
      ? 'F'
      : bare === 'Semifinal'
        ? 'SF'
        : bare === 'Quarterfinal'
          ? 'QF'
          : bare.replace('Round of ', 'R');

  if (slot === null) return short;
  // A hyphen is required when the abbreviation itself ends in a digit,
  // otherwise "R16" + slot 2 renders as "R162".
  return `${short}${/\d$/.test(short) ? '-' : ''}${slot + 1}`;
}

/**
 * Where an undecided slot's occupant will come from.
 *
 * Structured rather than a pre-rendered string because the query that reads
 * it does not know the reader's language, and because `=== 'Bye'` as a test
 * for "is this a bye" breaks the moment the word is translated — the draw
 * sheet was doing exactly that.
 */
export type DrawSource =
  | { readonly kind: 'bye' }
  | { readonly kind: 'groupRank'; readonly group: string; readonly rank: number }
  | {
      readonly kind: 'winnerOf' | 'loserOf';
      /** The feeding round's stored English name, or null if it is unknown. */
      readonly round: string | null;
      readonly slot: number | null;
    };

/** "Winner of SF1", "Ganador de SF1", "Grupo 2, 1.º", "Bye". */
export function sourceText(source: DrawSource | null, dict: Dictionary): string | null {
  if (source === null) return null;
  if (source.kind === 'bye') return dict.bye;
  if (source.kind === 'groupRank') {
    return fill(dict.groupPlace, {
      group: source.group,
      rank: ordinal(source.rank, dict),
    });
  }

  if (source.round === null) {
    return source.kind === 'winnerOf' ? dict.winnerOfPrevious : dict.loserOfPrevious;
  }
  const match = shortRoundRef(source.round, source.slot);
  const consolation = source.round.startsWith(CONSOLATION_PREFIX);
  const template =
    source.kind === 'winnerOf'
      ? consolation
        ? dict.winnerOfConsolation
        : dict.winnerOf
      : consolation
        ? dict.loserOfConsolation
        : dict.loserOf;
  return fill(template, { match });
}

/**
 * The one-line summary under a draw's title.
 *
 * Rebuilt from the counts stored on the stage rather than read from the
 * engine's `description`, which is English prose and was appearing verbatim
 * on a Spanish page. Older stages can recover counts from the engine's known
 * description format; unknown legacy prose remains the last-resort fallback.
 */
export interface StageSummaryConfig {
  readonly seedingMode?: string | null;
  readonly bracketSize?: number | null;
  readonly byeCount?: number | null;
  readonly entrantCount?: number | null;
  readonly seededCount?: number | null;
  readonly description?: string | null;
}

function countsFromDescription(description: string | null | undefined): StageSummaryConfig | null {
  if (description === null || description === undefined) return null;

  const field =
    /^(?<seeded>\d+) of (?<partialEntrants>\d+) entrants seeded|^Unseeded random draw of (?<unseededEntrants>\d+) entrants|^Fully seeded draw of (?<fullEntrants>\d+) entrants/.exec(
      description,
    );
  const bracket = /\bin (?:a|an) (?<size>\d+) bracket\b/.exec(description);
  const byes = / — (?:(?<none>no byes)|(?<count>\d+) byes?(?:[^.]*)?)\.$/.exec(description);
  if (field?.groups === undefined || bracket?.groups?.size === undefined || byes?.groups === undefined) {
    return null;
  }

  const entrantCount = Number(
    field.groups.partialEntrants ?? field.groups.unseededEntrants ?? field.groups.fullEntrants,
  );
  const seededCount =
    field.groups.seeded === undefined ? undefined : Number(field.groups.seeded);
  const bracketSize = Number(bracket.groups.size);
  const byeCount = byes.groups.none === undefined ? Number(byes.groups.count) : 0;
  if (
    !Number.isSafeInteger(entrantCount) ||
    !Number.isSafeInteger(bracketSize) ||
    !Number.isSafeInteger(byeCount) ||
    (seededCount !== undefined && !Number.isSafeInteger(seededCount))
  ) {
    return null;
  }

  return {
    entrantCount,
    bracketSize,
    byeCount,
    ...(seededCount === undefined ? {} : { seededCount }),
    seedingMode:
      field.groups.unseededEntrants !== undefined
        ? 'unseeded'
        : field.groups.fullEntrants !== undefined
          ? 'seeded'
          : 'partial',
  };
}

function roundRobinSummaryFromDescription(
  description: string | null | undefined,
  dict: Dictionary,
): string | null {
  if (description === null || description === undefined) return null;
  const match =
    /^(?<double>Double )?round robin of (?<entrants>\d+) entrants — (?<matches>\d+) matches? across (?<rounds>\d+) rounds?(?<rest>; each entrant sits out one round per cycle)?\.$/i.exec(
      description,
    );
  if (match?.groups === undefined) {
    return /^Double round robin|^Round robin/i.test(description)
      ? dict.roundRobinSummaryFallback
      : null;
  }

  const entrants = Number(match.groups['entrants']);
  const matches = Number(match.groups['matches']);
  const rounds = Number(match.groups['rounds']);
  if (![entrants, matches, rounds].every(Number.isSafeInteger)) return dict.roundRobinSummaryFallback;

  return fill(dict.roundRobinSummary, {
    format: match.groups['double'] === undefined ? dict.roundRobin : dict.doubleRoundRobin,
    entrants: `${entrants} ${(entrants === 1 ? dict.entrant : dict.entrants).toLowerCase()}`,
    matches: `${matches} ${(matches === 1 ? dict.match : dict.matches).toLowerCase()}`,
    rounds: `${rounds} ${rounds === 1 ? dict.round : dict.rounds}`,
    rest: match.groups['rest'] === undefined ? '' : dict.roundRobinOddRest,
  });
}

export function stageSummary(
  config: StageSummaryConfig | null,
  dict: Dictionary,
): string | null {
  if (config === null) return null;

  const roundRobinSummary = roundRobinSummaryFromDescription(config.description, dict);
  if (roundRobinSummary !== null) return roundRobinSummary;

  const fallbackCounts = countsFromDescription(config.description);
  const seedingMode = config.seedingMode ?? fallbackCounts?.seedingMode;
  const bracketSize = config.bracketSize ?? fallbackCounts?.bracketSize;
  const byeCount = config.byeCount ?? fallbackCounts?.byeCount;
  const entrantCount = config.entrantCount ?? fallbackCounts?.entrantCount;
  const seededCount = config.seededCount ?? fallbackCounts?.seededCount;
  if (
    typeof entrantCount !== 'number' ||
    typeof bracketSize !== 'number' ||
    typeof byeCount !== 'number'
  ) {
    return config.description ?? null;
  }

  const field =
    seedingMode === 'unseeded'
      ? fill(dict.drawUnseeded, { entrants: entrantCount })
      : seedingMode === 'seeded'
        ? fill(dict.drawFullySeeded, { entrants: entrantCount })
        : fill(dict.drawPartlySeeded, { seeded: seededCount ?? 0, entrants: entrantCount });

  const byes =
    byeCount === 0
      ? dict.drawNoByes
      : byeCount === 1
        ? dict.drawBye1
        : fill(dict.drawByesN, { n: byeCount });

  // An em dash with spaces, matching the rest of the product's prose. Not
  // " · ", which the design system bans as template chrome.
  return `${field} ${fill(dict.drawBracket, { size: bracketSize })} — ${byes}.`;
}

/**
 * Translate every round name in a list, in place of the stored English.
 *
 * Applied by the CALLER rather than inside the renderer that needs it,
 * because `DrawSheet` takes plain strings: a `(name) => string` prop cannot
 * cross the server→client boundary, and the build does not catch it —
 * serialization fails at request time.
 */
export function localizeRoundNames<T extends { readonly name: string }>(
  rounds: readonly T[],
  dict: Dictionary,
): readonly T[] {
  return rounds.map((round) => ({ ...round, name: roundLabel(round.name, dict) }));
}

/**
 * The screen-reader vocabulary a match node needs, from a dictionary.
 *
 * Here rather than in the node so the node stays free of the i18n module —
 * it is also rendered by the style guide, which has no locale.
 */
export function matchNodeLabels(dict: Dictionary): {
  readonly undecided: string;
  readonly versus: string;
  readonly defeated: string;
  readonly beat: (outcome: string) => string;
  readonly live: string;
  readonly seed: (n: number) => string;
  readonly receivesBye: (name: string) => string;
  readonly entrant: string;
} {
  return {
    undecided: dict.undecided,
    versus: dict.versus,
    defeated: dict.defeated,
    beat: (outcome) => fill(dict.beatWithOutcome, { outcome }),
    live: dict.live,
    seed: (n) => fill(dict.seedNumber, { n }),
    receivesBye: (name) => fill(dict.receivesBye, { name }),
    entrant: dict.entrant,
  };
}
