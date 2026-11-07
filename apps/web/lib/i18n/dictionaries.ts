/**
 * Translations.
 *
 * A hand-rolled dictionary rather than a library: the surface is small, every
 * page is a server component, and next-intl or similar would add a provider
 * tree and a middleware hop to look up forty strings.
 *
 * Spanish is a first-class locale here, not an afterthought. Where a literal
 * translation and the tennis term differ, the tennis term wins: a draw is a
 * "categoría" and a court is a "cancha" — NOT a "pista", which is what a court
 * is called in Spain. The club is in Tijuana; see the note on `court` below.
 */

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
/**
 * Spanish, because the club is in Tijuana and its members are the default
 * reader. English is the translation here, not the other way round — a first
 * visit with no cookie, and every QR code scanned off a poster, lands in
 * Spanish.
 */
export const DEFAULT_LOCALE: Locale = 'es';

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

  /* --- Draw vocabulary -------------------------------------------------
   * Round names are STORED in English (`rounds.name` is the canonical key
   * every admin list and the CSV export share). These translate them for
   * the reader; see lib/draw-text.ts.
   */
  readonly roundFinal: string;
  readonly roundSemifinal: string;
  readonly roundQuarterfinal: string;
  readonly roundOf16: string;
  /**
   * Templates, not functions.
   *
   * EVERY value in this dictionary must be a plain string: the whole object
   * is passed to client components (SiteNav, DrawSwitcher), and a function
   * anywhere in it makes the entire dictionary unserializable. The build
   * does NOT catch that — every page 500s at request time. Placeholders are
   * filled by lib/draw-text.
   */
  readonly roundOfN: string;
  /**
   * Wraps a round name. English puts the qualifier first, Spanish last; the
   * formatter capitalises `{round}` when it starts the phrase.
   */
  readonly roundConsolation: string;
  /** An undecided slot: "Winner of SF1" / "Ganador de SF1". */
  readonly winnerOf: string;
  readonly loserOf: string;
  readonly winnerOfPrevious: string;
  readonly loserOfPrevious: string;
  /** A group placing: "Group 2, 1st" / "Grupo 2, 1.º". */
  readonly groupPlace: string;
  /** Ordinals, spelled out because English needs four forms and Spanish one. */
  readonly ordinal1: string;
  readonly ordinal2: string;
  readonly ordinal3: string;
  readonly ordinalN: string;
  /** Shown when a slot is undecided and nothing is known about its source. */
  readonly undecided: string;

  /* --- Screen-reader sentence for a match node ------------------------- */
  readonly versus: string;
  readonly defeated: string;
  readonly beatWithOutcome: string;
  readonly seedNumber: string;
  readonly receivesBye: string;

  /* --- Draw summary, rebuilt from the stored counts --------------------- */
  readonly drawUnseeded: string;
  readonly drawFullySeeded: string;
  readonly drawPartlySeeded: string;
  readonly drawBracket: string;
  readonly drawNoByes: string;
  readonly drawBye1: string;
  readonly drawByesN: string;
  readonly thirdPlace: string;
  readonly court: string;
  readonly time: string;
  /** Header of the won–lost column on a printed round-robin box. */
  readonly wonLost: string;

  /* PUB-5/6/9/10: the pages about people rather than draws. */
  readonly searchTitle: string;
  readonly searchPlaceholder: string;
  readonly searchHint: string;
  readonly searchNoResults: string;
  readonly playerHistory: string;
  readonly playerEntries: string;
  readonly pathTitle: string;
  readonly choosePlayer: string;
  readonly viewMatch: string;
  readonly viewPath: string;
  readonly consolation: string;
  readonly consolationLead: string;
  readonly notPlayed: string;
  readonly backToDraw: string;
  readonly seedLabel: string;

  /* SCR-8: live connection state, shown to a spectator watching a draw. */
  readonly liveAuto: string;
  readonly liveReconnecting: string;
  readonly liveStopped: string;

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
  readonly payNow: string;
  readonly payLater: string;

  /* --- Entry form refusals, keyed by EnterError ------------------------
   * These were English sentences returned straight from the server action,
   * on the one page every QR poster points at.
   */
  readonly entryTooQuick: string;
  readonly entryRateLimited: string;
  readonly entryChallenge: string;
  readonly entryNeedName: string;
  readonly entryNeedEmail: string;
  readonly entryNeedPhone: string;
  readonly entryNeedDraw: string;
  readonly entryNotFound: string;
  readonly entryClosedError: string;
  readonly entryDrawNotHere: string;
  readonly entryDrawNotHeld: string;
  readonly entryNeedPartner: string;
  readonly entryAlready: string;
  readonly entrySaveFailed: string;

  /* Updates and media */
  readonly updates: string;
  readonly updatesSub: string;
  readonly noUpdates: string;
  readonly latestUpdates: string;
  readonly readMore: string;
  readonly allUpdates: string;
  readonly backToUpdates: string;
  readonly media: string;
  readonly mediaSub: string;
  readonly noMedia: string;
  readonly photos: string;
  readonly photo: string;
  readonly relatedTournament: string;
  readonly home: string;
  readonly scheduleBothTimes: string;
  readonly scheduleInvalidRange: string;
  readonly scheduleEndAfterStart: string;
  readonly scheduleAtLeastOne: string;
  readonly invalidTournamentLink: string;
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

  roundFinal: 'Final',
  roundSemifinal: 'Semifinal',
  roundQuarterfinal: 'Quarterfinal',
  roundOf16: 'Round of 16',
  roundOfN: 'Round of {n}',
  roundConsolation: 'Consolation {round}',
  winnerOf: 'Winner of {match}',
  loserOf: 'Loser of {match}',
  winnerOfPrevious: 'Winner of the previous match',
  loserOfPrevious: 'Loser of the previous match',
  groupPlace: '{group}, {rank}',
  ordinal1: '1st',
  ordinal2: '2nd',
  ordinal3: '3rd',
  ordinalN: '{n}th',
  undecided: 'To be decided',

  versus: 'versus',
  defeated: 'defeated',
  beatWithOutcome: 'beat ({outcome})',
  seedNumber: 'seed {n}',
  receivesBye: '{name} receives a bye',

  drawUnseeded: 'Unseeded random draw of {entrants}',
  drawFullySeeded: 'Fully seeded draw of {entrants}',
  drawPartlySeeded: '{seeded} of {entrants} seeded',
  // "in a draw of 8", not "in an 8 draw" — sidesteps a/an entirely.
  drawBracket: 'in a draw of {size}',
  drawNoByes: 'no byes',
  drawBye1: '1 bye',
  drawByesN: '{n} byes',
  thirdPlace: 'Third-place playoff',
  court: 'Court',
  time: 'Time',
  wonLost: 'W-L',
  searchTitle: 'Find a player',
  searchPlaceholder: 'Surname',
  searchHint: 'Search everyone entered in a published tournament.',
  searchNoResults: 'Nobody by that name.',
  playerHistory: 'Matches',
  playerEntries: 'Entered in',
  pathTitle: 'Path',
  choosePlayer: 'Choose a player',
  viewMatch: 'Match',
  // Neither language needs the word "bracket" — a club says
  // "the consolation" and everyone knows what it is.
  viewPath: 'Path',
  consolation: 'Consolation draw',
  consolationLead:
    'A second draw for everyone who lost their first match. Players who had a bye and then lost are not in it.',
  notPlayed: 'Not played yet',
  backToDraw: 'Back to the draw',
  seedLabel: 'seed',
  liveAuto: 'Updating automatically',
  liveReconnecting: 'Reconnecting',
  liveStopped: 'Not updating — reload the page',

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
  viewDraws: 'View the draws',
  youreIn: "You're in",
  enteredSingles: 'You are entered. Pay your entry fee at the desk.',
  enteredDoubles: 'You and {partner} are entered. Pay your entry fee at the desk.',
  division: 'Division',
  divisionOpen: 'Mixed',
  divisionMens: "Men's",
  divisionWomens: "Women's",
  payNow: 'Pay now',
  payLater: 'Or pay at the desk — card, cash, OXXO or bank transfer.',

  entryTooQuick: 'That was too quick — please try again.',
  entryRateLimited: 'Too many entries from this connection. Try again in a minute.',
  entryChallenge: 'Please complete the “I am human” check and try again.',
  entryNeedName: 'Enter your name.',
  entryNeedEmail: 'Enter a valid email address.',
  entryNeedPhone: 'Enter a phone number.',
  entryNeedDraw: 'Choose which draw you are entering.',
  entryNotFound: 'We could not find that tournament.',
  entryClosedError: 'Entries are closed for this tournament.',
  entryDrawNotHere: 'That draw is not part of this tournament.',
  entryDrawNotHeld: 'That draw is not being held.',
  entryNeedPartner: 'Doubles needs a partner name.',
  entryAlready: 'That email is already entered in this draw.',
  entrySaveFailed: 'We could not save your entry. Please try again.',

  updates: 'Updates',
  updatesSub: 'Club news, results and announcements.',
  noUpdates: 'Nothing has been posted yet.',
  latestUpdates: 'Latest',
  readMore: 'Read',
  allUpdates: 'All updates',
  backToUpdates: 'Back to updates',
  media: 'Media',
  mediaSub: 'Photos from around the club.',
  noMedia: 'No photos have been published yet.',
  photos: 'Photos',
  photo: 'Photo',
  relatedTournament: 'Related tournament',
  home: 'Home',
  scheduleBothTimes: 'Enter both times for a session, or leave both blank.',
  scheduleInvalidRange: '"{range}" is not a valid time range.',
  scheduleEndAfterStart: 'A session must end after it starts ({range}).',
  scheduleAtLeastOne: 'Add at least one playing session.',
  invalidTournamentLink: 'This tournament link is missing or not public: {path}',
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

  /*
   * Mexican tennis usage. "Cuartos de final" and "octavos de final" are what
   * a club says and prints; beyond that the strict forms
   * ("dieciseisavos", "treintaidosavos") are a mouthful nobody writes on a
   * clubhouse wall, so larger rounds read "Ronda de 32".
   */
  roundFinal: 'Final',
  roundSemifinal: 'Semifinal',
  roundQuarterfinal: 'Cuartos de final',
  roundOf16: 'Octavos de final',
  roundOfN: 'Ronda de {n}',
  roundConsolation: '{round} de consolación',
  winnerOf: 'Ganador de {match}',
  loserOf: 'Perdedor de {match}',
  winnerOfPrevious: 'Ganador del partido anterior',
  loserOfPrevious: 'Perdedor del partido anterior',
  groupPlace: '{group}, {rank}',
  ordinal1: '1.º',
  ordinal2: '2.º',
  ordinal3: '3.º',
  ordinalN: '{n}.º',
  undecided: 'Por definir',

  versus: 'contra',
  defeated: 'venció a',
  beatWithOutcome: 'ganó ({outcome}) a',
  seedNumber: 'cabeza de serie {n}',
  receivesBye: '{name} pasa por bye',

  drawUnseeded: 'Cuadro al azar sin cabezas de serie, {entrants} inscritos',
  drawFullySeeded: 'Cuadro totalmente sembrado, {entrants} inscritos',
  drawPartlySeeded: '{seeded} de {entrants} sembrados',
  drawBracket: 'en un cuadro de {size}',
  drawNoByes: 'sin byes',
  drawBye1: '1 bye',
  drawByesN: '{n} byes',
  thirdPlace: 'Partido por el tercer puesto',
  // Mexican Spanish throughout: the club is in Tijuana. "Pista" is what a
  // court is called in Spain; in Mexico it is a "cancha".
  court: 'Cancha',
  time: 'Hora',
  // "Ganados-Perdidos". The abbreviation is what a Mexican club writes at the
  // head of that column by hand, so it is what the printed box should say.
  wonLost: 'G-P',
  searchTitle: 'Buscar jugador',
  searchPlaceholder: 'Apellido',
  searchHint: 'Busca entre todos los inscritos en un torneo publicado.',
  searchNoResults: 'Nadie con ese nombre.',
  playerHistory: 'Partidos',
  playerEntries: 'Inscrito en',
  pathTitle: 'Recorrido',
  choosePlayer: 'Elige un jugador',
  viewMatch: 'Partido',
  viewPath: 'Recorrido',
  consolation: 'Cuadro de consolación',
  consolationLead:
    'Un segundo cuadro para quienes perdieron su primer partido. Quien tuvo bye y después perdió no entra.',
  // "Venció a" is what a Mexican results sheet says; "derrotó" reads formal.
  notPlayed: 'Aún no se juega',
  backToDraw: 'Volver al cuadro',
  seedLabel: 'siembra',
  liveAuto: 'Actualización automática',
  liveReconnecting: 'Reconectando',
  liveStopped: 'Sin actualizar — recarga la página',

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
  viewDraws: 'Ver las categorías',
  youreIn: '¡Listo!',
  enteredSingles: 'Ya estás inscrito. Paga la inscripción en recepción.',
  // "estáis" is vosotros -- peninsular. Mexico uses ustedes: "están".
  enteredDoubles: 'Tú y {partner} ya están inscritos. Paga la inscripción en recepción.',
  division: 'Modalidad',
  divisionOpen: 'Mixta',
  divisionMens: 'Masculino',
  divisionWomens: 'Femenino',
  payNow: 'Pagar ahora',
  payLater: 'O paga en recepción — tarjeta, efectivo, OXXO o transferencia.',

  entryTooQuick: 'Demasiado rápido — inténtalo de nuevo.',
  entryRateLimited: 'Demasiadas inscripciones desde esta conexión. Inténtalo en un minuto.',
  entryChallenge: 'Completa la verificación “no soy un robot” e inténtalo de nuevo.',
  entryNeedName: 'Escribe tu nombre.',
  entryNeedEmail: 'Escribe un correo electrónico válido.',
  entryNeedPhone: 'Escribe un teléfono.',
  entryNeedDraw: 'Elige la categoría en la que te inscribes.',
  entryNotFound: 'No encontramos ese torneo.',
  entryClosedError: 'Las inscripciones de este torneo ya cerraron.',
  entryDrawNotHere: 'Esa categoría no es de este torneo.',
  entryDrawNotHeld: 'Esa categoría no se va a jugar.',
  entryNeedPartner: 'En dobles hace falta el nombre de tu pareja.',
  entryAlready: 'Ese correo ya está inscrito en esta categoría.',
  entrySaveFailed: 'No pudimos guardar tu inscripción. Inténtalo de nuevo.',

  updates: 'Novedades',
  updatesSub: 'Noticias del club, resultados y avisos.',
  noUpdates: 'Todavía no se ha publicado nada.',
  latestUpdates: 'Lo más reciente',
  readMore: 'Leer',
  allUpdates: 'Todas las novedades',
  backToUpdates: 'Volver a novedades',
  media: 'Galería',
  mediaSub: 'Fotos del club.',
  noMedia: 'Todavía no se ha publicado ninguna foto.',
  photos: 'Fotos',
  photo: 'Foto',
  relatedTournament: 'Torneo relacionado',
  home: 'Inicio',
  scheduleBothTimes: 'Escribe las dos horas de la sesión o deja ambas en blanco.',
  scheduleInvalidRange: '"{range}" no es un horario válido.',
  scheduleEndAfterStart: 'La sesión debe terminar después de empezar ({range}).',
  scheduleAtLeastOne: 'Agrega al menos un horario de juego.',
  invalidTournamentLink: 'Este enlace de torneo no existe o no es público: {path}',
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
  // es-MX, not es-ES: this club is Mexican, and the tag drives date and
  // number formatting for every page.
  return locale === 'es' ? 'es-MX' : 'en-GB';
}
