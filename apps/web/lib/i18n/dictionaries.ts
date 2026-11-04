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

  /* Registration */
  readonly enterTitle: string;
  readonly enterSub: string;
  readonly chooseDraw: string;
  readonly yourName: string;
  readonly partnerName: string;
  readonly email: string;
  readonly phone: string;
  readonly enterButton: string;
  readonly sending: string;
  readonly entriesClosed: string;
  readonly entriesClosedBody: string;
  readonly viewDraws: string;
  readonly youreIn: string;
  readonly enteredSingles: string;
  /**
   * Contains {partner}, substituted at render.
   *
   * A plain string, NOT a function: the whole dictionary is passed from a
   * server component into a client one, and functions cannot cross that
   * boundary. A function here throws at request time, which the build does
   * not catch.
   */
  readonly enteredDoubles: string;
  readonly division: string;
  readonly divisionOpen: string;
  readonly divisionMens: string;
  readonly divisionWomens: string;
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

  enterTitle: 'Enter the tournament',
  enterSub: 'Pick your category and leave your details. Pay the entry fee at the desk.',
  chooseDraw: 'Category',
  yourName: 'Your full name',
  partnerName: "Your partner's name",
  email: 'Email',
  phone: 'Phone',
  enterButton: 'Enter',
  sending: 'Sending…',
  entriesClosed: 'Entries are closed',
  entriesClosedBody: 'This tournament is no longer accepting entries.',
  viewDraws: 'View the draws →',
  youreIn: "You're in",
  enteredSingles: 'You are entered. Pay your entry fee at the desk.',
  enteredDoubles: 'You and {partner} are entered. Pay your entry fee at the desk.',
  division: 'Division',
  divisionOpen: 'Open',
  divisionMens: "Men's",
  divisionWomens: "Women's",
};

const es: Dictionary = {
  localeName: 'Español',
  tournaments: 'Torneos',
  allTournaments: 'Todos los torneos',
  runningNow: 'En curso',
  upcoming: 'Próximos',
  results: 'Resultados',
  noTournaments: 'Todavía no se ha publicado ningún torneo.',
  draw: 'Categoría',
  draws: 'Categorías',
  entrant: 'Inscrito',
  entrants: 'Inscritos',
  match: 'Partido',
  matches: 'Partidos',
  tournament: 'Torneo',
  // Spanish-speaking clubs say "Singles" and "Dobles"; "Individual" reads
  // like a translation rather than the sport.
  singles: 'Singles',
  doubles: 'Dobles',
  singlesShort: 'S',
  doublesShort: 'D',
  roundRobin: 'Todos contra todos',
  singleElim: 'Eliminación directa',
  groupsPlayoff: 'Grupos → eliminatoria',
  notHeld: 'No disputado',
  notGenerated: 'Esta categoría todavía no se ha generado.',
  noDraws: 'Todavía no se ha publicado ninguna categoría.',
  live: 'En vivo',
  liveNow: 'En vivo ahora',
  bye: 'Bye',
  thirdPlace: 'Partido por el tercer puesto',
  court: 'Pista',

  enterTitle: 'Inscripción',
  enterSub: 'Elige tu categoría y deja tus datos. Paga la inscripción en recepción.',
  chooseDraw: 'Categoría',
  yourName: 'Tu nombre completo',
  partnerName: 'Nombre de tu pareja',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  enterButton: 'Inscribirme',
  sending: 'Enviando…',
  entriesClosed: 'Inscripciones cerradas',
  entriesClosedBody: 'Este torneo ya no acepta inscripciones.',
  viewDraws: 'Ver las categorías →',
  youreIn: '¡Listo!',
  enteredSingles: 'Ya estás inscrito. Paga la inscripción en recepción.',
  enteredDoubles: 'Tú y {partner} estáis inscritos. Paga la inscripción en recepción.',
  division: 'Modalidad',
  divisionOpen: 'Open',
  divisionMens: 'Masculino',
  divisionWomens: 'Femenino',
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Substitute a single named placeholder. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** BCP 47 tag for Intl formatting and the html lang attribute. */
export function intlLocale(locale: Locale): string {
  return locale === 'es' ? 'es-ES' : 'en-GB';
}
