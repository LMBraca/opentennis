/**
 * Translations.
 *
 * A hand-rolled dictionary rather than a library: the surface is small, every
 * page is a server component, and next-intl or similar would add a provider
 * tree and a middleware hop to look up forty strings.
 *
 * Spanish is a first-class locale here, not an afterthought. Where a literal
 * translation and the tennis term differ, the tennis term wins: a draw is a
 * "cuadro", a court is a "pista".
 */

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'es';
}

export interface Dictionary {
  readonly localeName: string;
  readonly tournaments: string;
  readonly allTournaments: string;
  readonly runningNow: string;
  readonly upcoming: string;
  readonly results: string;
  readonly noTournaments: string;
  readonly draw: string;
  readonly draws: string;
  readonly entrant: string;
  readonly entrants: string;
  readonly match: string;
  readonly matches: string;
  readonly tournament: string;
  readonly singles: string;
  readonly doubles: string;
  readonly singlesShort: string;
  readonly doublesShort: string;
  readonly roundRobin: string;
  readonly singleElim: string;
  readonly groupsPlayoff: string;
  readonly notHeld: string;
  readonly notGenerated: string;
  readonly noDraws: string;
  readonly live: string;
  readonly liveNow: string;
  readonly bye: string;
  readonly thirdPlace: string;
  readonly court: string;
}

const en: Dictionary = {
  localeName: 'English',
  tournaments: 'Tournaments',
  allTournaments: 'All tournaments',
  runningNow: 'Running now',
  upcoming: 'Upcoming',
  results: 'Results',
  noTournaments: 'No tournaments have been published yet.',
  draw: 'Draw',
  draws: 'Draws',
  entrant: 'Entrant',
  entrants: 'Entrants',
  match: 'Match',
  matches: 'Matches',
  tournament: 'Tournament',
  singles: 'Singles',
  doubles: 'Doubles',
  singlesShort: 'S',
  doublesShort: 'D',
  roundRobin: 'Round robin',
  singleElim: 'Single elim',
  groupsPlayoff: 'Groups → playoff',
  notHeld: 'Not held',
  notGenerated: 'This draw has not been generated yet.',
  noDraws: 'No draws have been published yet.',
  live: 'Live',
  liveNow: 'Live now',
  bye: 'Bye',
  thirdPlace: 'Third-place playoff',
  court: 'Court',
};

const es: Dictionary = {
  localeName: 'Español',
  tournaments: 'Torneos',
  allTournaments: 'Todos los torneos',
  runningNow: 'En curso',
  upcoming: 'Próximos',
  results: 'Resultados',
  noTournaments: 'Todavía no se ha publicado ningún torneo.',
  // "Cuadro" is the tennis term for a draw; "sorteo" is the act of drawing it.
  draw: 'Cuadro',
  draws: 'Cuadros',
  entrant: 'Inscrito',
  entrants: 'Inscritos',
  match: 'Partido',
  matches: 'Partidos',
  tournament: 'Torneo',
  singles: 'Individual',
  doubles: 'Dobles',
  singlesShort: 'I',
  doublesShort: 'D',
  roundRobin: 'Todos contra todos',
  singleElim: 'Eliminación directa',
  groupsPlayoff: 'Grupos → eliminatoria',
  notHeld: 'No disputado',
  notGenerated: 'Este cuadro todavía no se ha generado.',
  noDraws: 'Todavía no se ha publicado ningún cuadro.',
  live: 'En vivo',
  liveNow: 'En vivo ahora',
  bye: 'Bye',
  thirdPlace: 'Partido por el tercer puesto',
  court: 'Pista',
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** BCP 47 tag for Intl formatting and the html lang attribute. */
export function intlLocale(locale: Locale): string {
  return locale === 'es' ? 'es-ES' : 'en-GB';
}
