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
  /** RV-10: the print control on the draw-sheet page. */
  readonly printSheets: string;
  /** RV-11: order-of-play axis toggle and draw filter. */
  readonly groupBy: string;
  readonly allDraws: string;
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
  readonly matchCount1: string;
  readonly matchCountN: string;
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
  /**
   * OT-8. The match count on a draw that also has a consolation.
   *
   * `draw.rounds` is the main stage only, so a plain "Partidos" above a
   * two-bracket draw described half the tournament without saying so.
   * A phrase rather than Design's "partidos · cuadro principal", because
   * the design system bans " · " joined meta strings.
   */
  readonly matchesMainDraw: string;
  /**
   * OT-24. The games steppers' accessible names.
   *
   * Prefixed onto the existing `gamesAria` so a screen reader hears
   * "menos: Juegos de Rivas, set 2" — the action and the field it acts
   * on, which two bare "+" buttons per row cannot convey.
   */
  readonly increment: string;
  readonly decrement: string;
  /* OT-17. The overview's cell facts and masthead labels. */
  readonly entrantCount1: string;
  readonly entrantCountN: string;
  /**
   * A category that is on the books but has nobody in it yet. Distinct
   * from `notHeld` (the organizer decided against it) and from
   * `notGenerated` (there are entrants, the bracket is not made).
   */
  readonly noEntrantsYet: string;
  readonly dates: string;
  readonly venue: string;
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
  readonly roundIndexed: string;
  /**
   * Wraps a round name. English puts the qualifier first, Spanish last; the
   * formatter capitalises `{round}` when it starts the phrase.
   */
  readonly roundConsolation: string;
  /** An undecided slot: "Winner of SF1" / "Ganador de SF1". */
  readonly winnerOf: string;
  readonly loserOf: string;
  /**
   * OT-25. The same slot when the FEEDER is a consolation match.
   *
   * `shortRoundRef` strips the stage, so a consolation semifinal and a main
   * semifinal both shorten to "SF1" — two different matches rendering the
   * identical placeholder on one page. The stage has to come back in the
   * verb, because the coordinate cannot carry it.
   */
  readonly winnerOfConsolation: string;
  readonly loserOfConsolation: string;
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
  /**
   * OT-14. The profile's headline count is COMPLETED matches, and has to
   * say so: it read "1 Partido" above two cards, one of them unplayed, so
   * the number looked like a bug in the list rather than a different scope.
   */
  readonly completedMatches: string;
  readonly pathTitle: string;
  readonly choosePlayer: string;
  readonly viewMatch: string;
  readonly viewPath: string;
  readonly consolation: string;
  readonly consolationLead: string;
  readonly notPlayed: string;
  /**
   * OT-23. A finished match states its winner in words.
   *
   * The bracket's accessible name already said "venció a"; the visible page
   * showed only a score, so a reader had to infer the winner from which row
   * was bold. Four templates rather than one with an injected verb, because
   * the outcome changes the verb itself in both languages.
   */
  readonly resultPlayed: string;
  readonly resultRetired: string;
  readonly resultWalkover: string;
  readonly resultDefault: string;
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
  /**
   * OT-12. What a player sees when the club reviews entries.
   *
   * With review on, no entrant row is created — and the form still said
   * "¡Listo! Ya estás inscrito. Paga la inscripción en recepción." So the
   * product promised a place it had not given and asked for money for it.
   */
  readonly entryPendingTitle: string;
  readonly entryPendingBody: string;
  /** OT-12. For a status surface; no route reads the token yet. */
  readonly entryRejectedBody: string;
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
  /**
   * OT-18. The summary above a refused form.
   *
   * Every required field carried `required`, so the BROWSER refused the
   * submit before the server ever saw it — "Please select an item in the
   * list.", in the browser's language, on a Spanish-first page. The form
   * validates itself now and these name the damage.
   */
  readonly formErrorSummary1: string;
  readonly formErrorSummaryN: string;
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

  /* Localized recovery, admin sign-in and scorekeeper surfaces. */
  readonly notFoundTitle: string;
  readonly notFoundBody: string;
  readonly notFoundHome: string;
  readonly notFoundSearch: string;
  readonly adminEyebrow: string;
  readonly signIn: string;
  readonly signingIn: string;
  readonly password: string;
  readonly loginNeedBoth: string;
  readonly loginMismatch: string;
  readonly scoreLinkInvalid: string;
  readonly scoreLinkInvalidBody: string;
  readonly scoringAs: string;
  readonly scoresTitle: string;
  readonly readyToScore: string;
  readonly recorded: string;
  readonly waitingEarlier: string;
  readonly readyToScoreEmpty: string;
  readonly waitingOnResult: string;
  readonly enterResult: string;
  readonly editResult: string;
  readonly closeResult: string;
  readonly howDidItEnd: string;
  readonly outcomePlayed: string;
  readonly outcomeRetired: string;
  readonly outcomeWalkover: string;
  readonly outcomeDefault: string;
  readonly whoCarriedOn: string;
  readonly whoAwarded: string;
  readonly setN: string;
  readonly saveResult: string;
  readonly saving: string;
  readonly cancel: string;
  readonly undo: string;
  readonly undoing: string;
  readonly clearResult: string;
  readonly clearing: string;
  readonly gamesAria: string;
  readonly tiebreakAria: string;
  readonly drawKeyboardHint: string;
  readonly zoomOut: string;
  readonly zoomIn: string;
  readonly orderOfPlay: string;
  readonly orderOfPlayLead: string;
  readonly orderOfPlayEmptyLead: string;
  readonly nothingScheduled: string;
  readonly notScheduled: string;
  readonly unscheduled1: string;
  readonly unscheduledN: string;
  readonly signOut: string;
  readonly signedInAs: string;
  readonly permissionDenied: string;
  readonly askOwner: string;
  readonly denialDeleteTournament: string;
  readonly denialManageTournaments: string;
  readonly denialManageDraws: string;
  readonly denialChangeEntrants: string;
  readonly denialRecordScores: string;
  readonly denialManageContent: string;
  readonly denialManageScorekeepers: string;
  readonly denialMergePlayers: string;
  readonly newTournament: string;
  readonly updatesAndMedia: string;
  readonly players: string;
  readonly categories: string;
  readonly noTournamentsYet: string;
  readonly draftLabel: string;
  readonly manage: string;
  readonly schedule: string;
  readonly viewPublic: string;
  readonly details: string;
  readonly tournamentName: string;
  readonly tournamentNameExample: string;
  readonly starts: string;
  readonly ends: string;
  readonly runConsolation: string;
  readonly runConsolationHint: string;
  readonly creating: string;
  readonly createTournament: string;
  readonly courts: string;
  readonly courtsAvailable: string;
  readonly minutesPerMatch: string;
  readonly restBetweenMatches: string;
  readonly playingHours: string;
  readonly leaveSessionBlank: string;
  readonly noStartDate: string;
  readonly scheduleStarts: string;
  readonly weekdayMorning: string;
  readonly weekdayEvening: string;
  readonly weekend: string;
  readonly slotsAvailablePerWeek: string;
  readonly scheduling: string;
  readonly saveAndGenerateSchedule: string;
  readonly backToTournaments: string;
  readonly scheduleTitle: string;
  readonly scheduleCourtsRangeError: string;
  readonly scheduleMinMatchDurationError: string;
  readonly scheduleNoDraws: string;
  readonly scheduleSummary: string;
  readonly scheduleFinalsWithin: string;
  readonly scheduleUnplaced1: string;
  readonly scheduleUnplacedN: string;
  readonly scheduleSpread: string;
  readonly entriesTitle: string;
  readonly qrCodesTitle: string;
  readonly drawSheetsTitle: string;
  readonly scorekeepersTitle: string;
  readonly newUpdateTitle: string;
  readonly editUpdateTitle: string;
  readonly manageTournamentTitle: string;
  readonly scheduled: string;
  readonly status: string;
  readonly phaseSetup: string;
  readonly phaseEntries: string;
  readonly phaseDraws: string;
  readonly phasePlay: string;
  readonly phaseDone: string;
  readonly phaseCancelled: string;
  readonly tournamentProgress: string;
  readonly manageChooseCategories: string;
  readonly manageChooseCategoriesDetail: string;
  readonly openEntries: string;
  readonly playersCanEnter: string;
  readonly closeEntries: string;
  readonly noCategoriesChosen: string;
  readonly drawsReadyAfterFieldSettled: string;
  readonly fieldSettled: string;
  readonly drawProgress: string;
  readonly generateDraws: string;
  readonly generateAllDraws: string;
  readonly generating: string;
  readonly tickCellToRunCategory: string;
  readonly recordResults: string;
  readonly matchesPlayed: string;
  readonly markTournamentComplete: string;
  readonly everyMatchHasResult: string;
  readonly finishedDrawsStayPublished: string;
  readonly tournamentCancelled: string;
  readonly working: string;
  readonly entrantsSoFarShare: string;
  readonly mixedDivision: string;
  readonly divisionMensLabel: string;
  readonly divisionWomensLabel: string;
  readonly drawGrid: string;
  readonly add: string;
  readonly formatFor: string;
  readonly entrantsShort: string;
  readonly matchesShort: string;
  readonly drawn: string;
  readonly notDrawn: string;
  readonly entriesOpenLabel: string;
  readonly drawAction: string;
  readonly reopen: string;
  readonly removeDraw: string;
  readonly exportResults: string;
  readonly copy: string;
  readonly copied: string;
  readonly openLink: string;
  readonly statusAndVisibility: string;
  readonly dangerZone: string;
  readonly stage: string;
  readonly statusDraft: string;
  readonly statusPublished: string;
  readonly statusInProgress: string;
  readonly statusComplete: string;
  readonly statusCancelled: string;
  readonly visibility: string;
  readonly hidden: string;
  readonly unlisted: string;
  readonly publicLabel: string;
  readonly visibilityHiddenHint: string;
  readonly visibilityUnlistedHint: string;
  readonly visibilityPublicHint: string;
  readonly viewPublicPage: string;
  readonly pendingEntries: string;
  readonly handledEntries: string;
  /**
   * OT-11. Entries are open, but the tournament is not on the homepage.
   *
   * Opening entries used to publish it as a side effect. Now it does not,
   * which means the organizer has to be told — otherwise the surprise just
   * moves from "it went public on its own" to "nobody can find it".
   */
  readonly openButNotPublic: string;
  /**
   * OT-9. The bulk generate button, when some draws already exist.
   *
   * `generateDraws` skips an event that already has matches rather than
   * replacing it, so "Generate all draws" overstated what the click does.
   */
  readonly generateRemainingDraws: string;
  readonly allDrawsGenerated: string;
  /**
   * OT-19. Consequences, for the shared inline confirmation.
   *
   * Each says what the button alone does not. "Are you sure?" is not a
   * safeguard — it asks a question the reader has no way to answer.
   */
  /**
   * The updates CMS row actions.
   *
   * OT-22 leftover: `/admin/updates` took no dictionary at all and
   * hardcoded both these labels and `venueArticleDateFormatter('en-GB')`,
   * so the list stayed English — and its dates stayed English — whatever
   * the organizer had chosen. Found while adding OT-19's confirmations,
   * which have to be localized to be worth reading.
   */
  readonly updatesTitle: string;
  readonly edit: string;
  readonly publish: string;
  readonly unpublish: string;
  readonly view: string;
  readonly deleteLabel: string;
  readonly clearResultConsequence: string;
  readonly revokeLinkConsequence: string;
  /**
   * OT-10. Reissue, because the stored token is a hash and the URL cannot
   * be shown again — the only honest alternative to revealing a secret.
   */
  readonly replaceLink: string;
  readonly replaceLinkConsequence: string;
  readonly rejectEntryConsequence: string;
  /** OT-19. Prefixed to the consequence for a bulk rejection. */
  readonly rejectCountN: string;
  readonly hideTournamentConsequence: string;
  readonly deleteUpdateConsequence: string;
  readonly unpublishUpdateConsequence: string;
  readonly publishUpdateConsequence: string;
  readonly entriesWaitHere: string;
  readonly entriesGoStraightToDraw: string;
  readonly entriesReviewOnHint: string;
  readonly entriesReviewOffHint: string;
  readonly turnReviewOff: string;
  readonly turnReviewOn: string;
  readonly noEntriesYet: string;
  readonly waitingForYou: string;
  readonly alreadyReviewed: string;
  /**
   * OT-12. Accepted and rejected are separate lists.
   *
   * They were one "handled" group, so a rejected player sat in the same
   * list as everyone who got in — the organizer had to read a chip on each
   * row to tell who was actually in the tournament.
   */
  readonly acceptedEntries: string;
  readonly rejectedEntries: string;
  /**
   * OT-13. Accepted is not the same as placed in a bracket.
   *
   * "Entries go straight into the draw" was shown next to accepted
   * entrants while no matches existed, which reads as a draw that has
   * already been made.
   */
  readonly acceptedAppearOnGenerate: string;
  readonly selectedCount: string;
  readonly nothingSelected: string;
  readonly accepting: string;
  readonly acceptSelected: string;
  readonly rejectSelected: string;
  readonly selectAll: string;
  readonly move: string;
  readonly select: string;
  readonly accept: string;
  readonly reject: string;
  readonly selectEntry: string;
  readonly withPartner: string;
  readonly via: string;
  readonly accepted: string;
  readonly rejected: string;
  readonly scorekeepersLead: string;
  readonly activeLink: string;
  readonly activeLinks: string;
  readonly scorekeeperExample: string;
  readonly scorekeeperForLabel: string;
  readonly createLink: string;
  readonly creatingLink: string;
  readonly noScorekeeperLinks: string;
  readonly linkCreatedFor: string;
  readonly scorekeeperLink: string;
  readonly created: string;
  readonly neverUsed: string;
  readonly lastUsed: string;
  readonly revoked: string;
  readonly revoke: string;
  readonly scorekeeperPermissions: string;
  readonly scorekeeperMissingLabel: string;
  readonly scorekeeperTournamentNotFound: string;
  readonly registrationTitle: string;
  readonly entriesOpenShare: string;
  readonly entriesClosedHidden: string;
  readonly entriesClosedLinkStillWorks: string;
  readonly linkNotLive: string;
}

const en: Dictionary = {
  localeName: 'English',
  printSheets: 'Print sheets',
  groupBy: 'Group by',
  allDraws: 'All draws',
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
  matchCount1: '1 match',
  matchCountN: '{n} matches',
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
  matchesMainDraw: 'matches in the main draw',
  increment: 'one more',
  decrement: 'one fewer',
  entrantCount1: '1 entrant',
  entrantCountN: '{n} entrants',
  noEntrantsYet: 'No entrants yet.',
  dates: 'dates',
  venue: 'venue',
  noDraws: 'No draws have been published yet.',
  live: 'Live',
  liveNow: 'Live now',
  bye: 'Bye',

  roundFinal: 'Final',
  roundSemifinal: 'Semifinal',
  roundQuarterfinal: 'Quarterfinal',
  roundOf16: 'Round of 16',
  roundOfN: 'Round of {n}',
  roundIndexed: 'Round {n}',
  roundConsolation: 'Consolation {round}',
  winnerOf: 'Winner of {match}',
  loserOf: 'Loser of {match}',
  winnerOfConsolation: 'Winner of cons. {match}',
  loserOfConsolation: 'Loser of cons. {match}',
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
  court: 'Cancha',
  time: 'Time',
  wonLost: 'W-L',
  searchTitle: 'Find a player',
  searchPlaceholder: 'Surname',
  searchHint: 'Search everyone entered in a published tournament.',
  searchNoResults: 'Nobody by that name.',
  playerHistory: 'Matches',
  playerEntries: 'Entered in',
  completedMatches: 'completed matches',
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
  resultPlayed: 'Finished · {winner} defeated {loser}',
  resultRetired: 'Finished · {winner} beat (retired) {loser}',
  resultWalkover: 'Finished · {winner} beat (walkover) {loser}',
  resultDefault: 'Finished · {winner} beat (default) {loser}',
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
  entryPendingTitle: 'We have your entry',
  entryPendingBody: 'The organizer is reviewing it.',
  entryRejectedBody: 'Your entry was not accepted in this draw.',
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
  formErrorSummary1: 'Check 1 field.',
  formErrorSummaryN: 'Check {n} fields.',
  entryNotFound: 'We could not find that tournament.',
  entryClosedError: 'Entries are closed for this tournament.',
  entryDrawNotHere: 'That draw is not part of this tournament.',
  entryDrawNotHeld: 'That draw is not being held.',
  entryNeedPartner: 'Doubles needs a partner name.',
  entryAlready: 'That email is already entered in this draw.',
  entrySaveFailed: 'We could not save your entry. Please try again.',

  updates: 'Blog',
  updatesSub: 'Club news, results and announcements.',
  noUpdates: 'Nothing has been posted yet.',
  latestUpdates: 'Latest',
  readMore: 'Read',
  allUpdates: 'All updates',
  backToUpdates: 'Back to the blog',
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

  notFoundTitle: 'We couldn’t find this page',
  notFoundBody: 'The link may be mistyped, or this page is no longer published.',
  notFoundHome: 'Go to the home page',
  notFoundSearch: 'Find a player',
  adminEyebrow: 'Admin',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  password: 'Password',
  loginNeedBoth: 'Enter your email and password.',
  loginMismatch: 'Those details did not match an account.',
  scoreLinkInvalid: 'Link not valid',
  scoreLinkInvalidBody:
    'This scoring link does not work any more. Ask the organizer for a new one.',
  scoringAs: 'Scoring as {label}.',
  scoresTitle: 'Scores',
  readyToScore: 'Ready to score',
  recorded: 'Recorded',
  waitingEarlier: 'Waiting on an earlier result',
  readyToScoreEmpty:
    'Nothing is waiting for a score. Generate a draw, or record a result to open the next round.',
  waitingOnResult: 'Waiting on a result',
  enterResult: 'Enter result',
  editResult: 'Edit',
  closeResult: 'Close',
  howDidItEnd: 'How did it end?',
  outcomePlayed: 'Played',
  outcomeRetired: 'Retired',
  outcomeWalkover: 'Walkover',
  outcomeDefault: 'Default',
  whoCarriedOn: 'Who carried on?',
  whoAwarded: 'Who was awarded the match?',
  setN: 'Set {n}',
  saveResult: 'Save result',
  saving: 'Saving…',
  cancel: 'Cancel',
  undo: 'Undo',
  undoing: 'Undoing…',
  clearResult: 'Clear',
  clearing: 'Clearing…',
  gamesAria: '{name} games, set {n}',
  tiebreakAria: '{name} tiebreak points, set {n}',
  drawKeyboardHint: 'Draw. Use the arrow keys to move between matches.',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  orderOfPlay: 'Order of play',
  orderOfPlayLead: 'Print this for the clubhouse wall. Reprint it when times change.',
  orderOfPlayEmptyLead:
    'No match has been given a time yet. Set Cancha hours on the schedule page, then schedule the draws.',
  nothingScheduled: 'Nothing scheduled.',
  notScheduled: 'not scheduled',
  unscheduled1: '1 match is still without a time and is not listed here.',
  unscheduledN: '{n} matches are still without a time and are not listed here.',
  signOut: 'Sign out',
  signedInAs: 'Signed in as {email}',
  permissionDenied: 'Your account ({role}) cannot {action}.',
  askOwner: 'Ask the club owner if you need to.',
  denialDeleteTournament: 'delete a tournament',
  denialManageTournaments: 'create or change tournaments',
  denialManageDraws: 'manage draws',
  denialChangeEntrants: 'change entrants',
  denialRecordScores: 'record scores',
  denialManageContent: 'edit club content',
  denialManageScorekeepers: 'manage scorekeeper links',
  denialMergePlayers: 'merge players',
  newTournament: 'New tournament',
  updatesAndMedia: 'Blog & media',
  players: 'Players',
  categories: 'Categories',
  noTournamentsYet: 'No tournaments yet.',
  draftLabel: 'Draft',
  manage: 'Manage',
  schedule: 'Schedule',
  viewPublic: 'View public',
  details: 'Details',
  tournamentName: 'Name',
  tournamentNameExample: 'Open Tennis Summer Championship',
  starts: 'Starts',
  ends: 'Ends',
  runConsolation: 'Run a consolation draw',
  runConsolationHint:
    'Everyone who loses their first match goes into a second, smaller bracket, so nobody travels for one match. Applies to knockout draws when you generate them — round robins already give everyone several matches. Decide now: it cannot be added to a draw that has already been made.',
  creating: 'Creating…',
  createTournament: 'Create tournament',
  courts: 'Canchas',
  courtsAvailable: 'Canchas available',
  minutesPerMatch: 'Minutes per match',
  restBetweenMatches: 'Rest between matches',
  playingHours: 'Playing hours',
  leaveSessionBlank: 'Leave a session blank if you do not play then.',
  noStartDate: 'This tournament has no start date, so scheduling begins today.',
  scheduleStarts: 'Scheduling starts {date}.',
  weekdayMorning: 'Mon–Fri morning',
  weekdayEvening: 'Mon–Fri evening',
  weekend: 'Sat & Sun',
  slotsAvailablePerWeek: 'slots available per week.',
  scheduling: 'Scheduling…',
  saveAndGenerateSchedule: 'Save and generate schedule',
  backToTournaments: 'Back to tournaments',
  scheduleTitle: 'Courts and schedule',
  scheduleCourtsRangeError: 'The number of Canchas must be between 1 and 40.',
  scheduleMinMatchDurationError: 'Allow at least 15 minutes per match.',
  scheduleNoDraws: 'Generate a draw before scheduling matches.',
  scheduleSummary: '{scheduled} of {total} {matches} across {courts} Canchas over {days} days',
  scheduleFinalsWithin: '; all finals are within {days} days of each other.',
  scheduleUnplaced1: '1 match could not be placed within {days} days.',
  scheduleUnplacedN: '{n} matches could not be placed within {days} days.',
  scheduleSpread: 'Finals are spread across {days} days. Add Canchas or hours to tighten this.',
  entriesTitle: 'Entries',
  qrCodesTitle: 'QR codes',
  drawSheetsTitle: 'Draw sheets',
  scorekeepersTitle: 'Scorekeepers',
  newUpdateTitle: 'New update',
  editUpdateTitle: 'Edit update',
  manageTournamentTitle: 'Manage tournament',
  scheduled: 'scheduled',
  status: 'Status',
  phaseSetup: 'Setup',
  phaseEntries: 'Entries open',
  phaseDraws: 'Draws',
  phasePlay: 'In play',
  phaseDone: 'Complete',
  phaseCancelled: 'Cancelled',
  tournamentProgress: 'Tournament progress',
  manageChooseCategories: 'Choose the categories you are running',
  manageChooseCategoriesDetail:
    'Pick a cell below. Nobody can enter until there is something to enter.',
  openEntries: 'Open entries',
  playersCanEnter: 'Players can then sign themselves up.',
  closeEntries: 'Close entries',
  noCategoriesChosen: 'No categories chosen yet — add one before closing.',
  drawsReadyAfterFieldSettled: 'Draws can be generated once the field is settled.',
  fieldSettled: 'Entries are closed, so the field is settled.',
  drawProgress: '{drawn} of {total} done.',
  generateDraws: 'Generate the draws',
  generateAllDraws: 'Generate all draws',
  generating: 'Generating…',
  tickCellToRunCategory: 'Tick a cell to run that category.',
  recordResults: 'Record results',
  matchesPlayed: '{played} of {total} matches played.',
  markTournamentComplete: 'Mark the tournament complete',
  everyMatchHasResult: 'Every match has a result.',
  finishedDrawsStayPublished: 'Finished. The draws stay published.',
  tournamentCancelled: 'This tournament was cancelled.',
  working: 'Working…',
  entrantsSoFarShare: '{count} entrants so far. Share this:',
  mixedDivision: 'Mixed',
  divisionMensLabel: "Men's",
  divisionWomensLabel: "Women's",
  drawGrid: 'Draws',
  add: 'Add',
  formatFor: 'Format for {category} {discipline}',
  entrantsShort: 'entr',
  matchesShort: 'mat',
  drawn: 'Drawn',
  notDrawn: 'Not drawn',
  entriesOpenLabel: 'Entries open',
  drawAction: 'Draw',
  reopen: 'Reopen',
  removeDraw: 'Remove draw',
  exportResults: 'Export results',
  copy: 'Copy',
  copied: 'Copied',
  openLink: 'Open',
  statusAndVisibility: 'Status and visibility',
  dangerZone: 'Danger zone',
  stage: 'Stage',
  statusDraft: 'Draft',
  statusPublished: 'Published',
  statusInProgress: 'In progress',
  statusComplete: 'Complete',
  statusCancelled: 'Cancelled',
  visibility: 'Visibility',
  hidden: 'Hidden',
  unlisted: 'Unlisted',
  publicLabel: 'Public',
  visibilityHiddenHint: 'Hidden: nobody can see this tournament or its draws.',
  visibilityUnlistedHint: 'Unlisted: reachable by link, but not listed on the home page.',
  visibilityPublicHint: 'Public: listed on the home page.',
  viewPublicPage: 'View public page',
  pendingEntries: 'waiting',
  handledEntries: 'handled',
  openButNotPublic:
    'Entries are open, but this tournament is not on the home page yet. Share the sign-up link, or publish it under Status and visibility.',
  generateRemainingDraws: 'Generate the remaining {n}',
  allDrawsGenerated: 'Every draw is generated.',
  updatesTitle: 'Blog',
  edit: 'Edit',
  publish: 'Publish',
  unpublish: 'Unpublish',
  view: 'View',
  deleteLabel: 'Delete',
  clearResultConsequence:
    'The score is deleted and this match goes back to unplayed. The place it feeds in the next round is emptied too.',
  revokeLinkConsequence:
    'The current link stops working immediately. Anyone using it on court will be signed out mid-match.',
  replaceLink: 'Replace link',
  replaceLinkConsequence:
    'The current link will stop working as soon as the new one is created. You will see the new link once.',
  rejectEntryConsequence:
    'This player will not be in the draw. They are not told automatically — you will need to let them know.',
  rejectCountN: 'Rejecting {n} entries.',
  hideTournamentConsequence:
    'The tournament comes off the home page and its public pages stop resolving. Printed QR codes will not work until you publish it again.',
  deleteUpdateConsequence: 'The article is deleted. This cannot be undone.',
  unpublishUpdateConsequence:
    'The article comes off the public site. Anyone holding a link to it will get the not-found page.',
  publishUpdateConsequence: 'The article goes live on the public site straight away.',
  entriesWaitHere: 'Entries wait here for you to accept them',
  // OT-13: "straight into the draw" promised a bracket place. Review off
  // means accepted immediately, which is a different claim.
  entriesGoStraightToDraw: 'Entries are accepted automatically',
  entriesReviewOnHint:
    'Nothing reaches a draw until you accept it. Players still see their confirmation.',
  entriesReviewOffHint:
    'This is what the club asked for. Switch review on if the form starts attracting junk.',
  turnReviewOff: 'Turn review off',
  turnReviewOn: 'Turn review on',
  noEntriesYet: 'No entries yet. Share the entry link or a QR code and they will appear here.',
  waitingForYou: 'Waiting for you',
  alreadyReviewed: 'Already reviewed',
  acceptedEntries: 'Accepted',
  rejectedEntries: 'Rejected',
  acceptedAppearOnGenerate: 'Accepted entrants will appear in the draw once it is generated.',
  selectedCount: '{count} selected',
  nothingSelected: 'Nothing selected',
  accepting: 'Accepting…',
  acceptSelected: 'Accept selected',
  rejectSelected: 'Reject selected',
  selectAll: 'Select all',
  move: 'move',
  select: 'select',
  accept: 'accept',
  reject: 'reject',
  selectEntry: 'Select {name}',
  withPartner: 'with {partner}',
  via: 'via {source}',
  accepted: 'accepted',
  rejected: 'rejected',
  scorekeepersLead:
    'Give a volunteer a link and they can enter scores for this tournament from their phone. No account, no password, and you can revoke it when the weekend is over.',
  activeLink: 'active link',
  activeLinks: 'active links',
  scorekeeperExample: 'Marco, Cancha 1–2',
  scorekeeperForLabel: 'Who is this link for?',
  createLink: 'Create link',
  creatingLink: 'Creating…',
  noScorekeeperLinks: 'No links yet.',
  linkCreatedFor: 'Link created for {label}. Copy it now — it is not shown again.',
  scorekeeperLink: 'Scorekeeper link',
  created: 'created {date}',
  neverUsed: 'never used',
  lastUsed: 'last used {date}',
  revoked: 'revoked',
  revoke: 'Revoke',
  scorekeeperPermissions:
    'A link lets its holder record, clear and undo results for this tournament only. It cannot change draws, entrants or anything else.',
  scorekeeperMissingLabel: 'Give the link a name, so you know whose it is.',
  scorekeeperTournamentNotFound: 'Tournament not found.',
  registrationTitle: 'Registration',
  entriesOpenShare:
    'Entries are open. Share this link — players enter themselves and appear below straight away.',
  entriesClosedHidden:
    'Entries are closed and this tournament is hidden, so the link will not open for anyone. Open entries to start collecting.',
  entriesClosedLinkStillWorks:
    'Entries are closed. The link still works and says so, which is why a printed poster never dead-ends.',
  linkNotLive: 'This link is not live yet.',
};

const es: Dictionary = {
  localeName: 'Español',
  printSheets: 'Imprimir hojas',
  groupBy: 'Agrupar por',
  allDraws: 'Todos los cuadros',
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
  matchCount1: '1 partido',
  matchCountN: '{n} partidos',
  tournament: 'Torneo',
  // Spanish-speaking clubs say "Singles" and "Dobles"; "Individual" reads
  // like a translation rather than the sport.
  singles: 'Singles',
  doubles: 'Dobles',
  singlesShort: 'S',
  doublesShort: 'D',
  // RV-1: organizers say "round robin", in both languages.
  roundRobin: 'Round robin',
  singleElim: 'Eliminación directa',
  groupsPlayoff: 'Grupos → eliminatoria',
  notHeld: 'No disputado',
  notGenerated: 'Esta categoría todavía no se ha generado.',
  matchesMainDraw: 'partidos del cuadro principal',
  increment: 'uno más',
  decrement: 'uno menos',
  entrantCount1: '1 inscrito',
  entrantCountN: '{n} inscritos',
  noEntrantsYet: 'Todavía no hay inscritos.',
  dates: 'fechas',
  venue: 'sede',
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
  roundIndexed: 'Ronda {n}',
  roundConsolation: '{round} de consolación',
  winnerOf: 'Ganador de {match}',
  loserOf: 'Perdedor de {match}',
  winnerOfConsolation: 'Ganador de cons. {match}',
  loserOfConsolation: 'Perdedor de cons. {match}',
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
  completedMatches: 'partidos jugados',
  pathTitle: 'Recorrido',
  choosePlayer: 'Elige un jugador',
  viewMatch: 'Partido',
  viewPath: 'Recorrido',
  consolation: 'Cuadro de consolación',
  consolationLead:
    'Un segundo cuadro para quienes perdieron su primer partido. Quien tuvo bye y después perdió no entra.',
  // "Venció a" is what a Mexican results sheet says; "derrotó" reads formal.
  notPlayed: 'Aún no se juega',
  resultPlayed: 'Finalizado · {winner} venció a {loser}',
  resultRetired: 'Finalizado · {winner} ganó (retiro) a {loser}',
  resultWalkover: 'Finalizado · {winner} ganó (walkover) a {loser}',
  resultDefault: 'Finalizado · {winner} ganó (default) a {loser}',
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
  entryPendingTitle: 'Recibimos tu inscripción',
  entryPendingBody: 'El organizador la está revisando.',
  entryRejectedBody: 'Tu inscripción no fue aceptada en esta categoría.',
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
  formErrorSummary1: 'Revisa 1 campo.',
  formErrorSummaryN: 'Revisa {n} campos.',
  entryNotFound: 'No encontramos ese torneo.',
  entryClosedError: 'Las inscripciones de este torneo ya cerraron.',
  entryDrawNotHere: 'Esa categoría no es de este torneo.',
  entryDrawNotHeld: 'Esa categoría no se va a jugar.',
  entryNeedPartner: 'En dobles hace falta el nombre de tu pareja.',
  entryAlready: 'Ese correo ya está inscrito en esta categoría.',
  entrySaveFailed: 'No pudimos guardar tu inscripción. Inténtalo de nuevo.',

  updates: 'Blog',
  updatesSub: 'Noticias del club, resultados y avisos.',
  noUpdates: 'Todavía no se ha publicado nada.',
  latestUpdates: 'Lo más reciente',
  readMore: 'Leer',
  allUpdates: 'Todas las novedades',
  backToUpdates: 'Volver al blog',
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

  notFoundTitle: 'No encontramos esta página',
  notFoundBody: 'Es posible que el enlace esté mal escrito o que esta página ya no esté publicada.',
  notFoundHome: 'Ir al inicio',
  notFoundSearch: 'Buscar un jugador',
  adminEyebrow: 'Administración',
  signIn: 'Iniciar sesión',
  signingIn: 'Entrando…',
  password: 'Contraseña',
  loginNeedBoth: 'Escribe tu correo y tu contraseña.',
  loginMismatch: 'Esos datos no coinciden con ninguna cuenta.',
  scoreLinkInvalid: 'Enlace no válido',
  scoreLinkInvalidBody: 'Este enlace de marcador ya no funciona. Pide uno nuevo al organizador.',
  scoringAs: 'Anotando como {label}.',
  scoresTitle: 'Marcador',
  readyToScore: 'Listos para anotar',
  recorded: 'Registrados',
  waitingEarlier: 'En espera de un resultado anterior',
  readyToScoreEmpty:
    'No hay ningún partido listo para anotar. Genera un cuadro, o registra un resultado para abrir la siguiente ronda.',
  waitingOnResult: 'En espera de un resultado',
  enterResult: 'Anotar resultado',
  editResult: 'Editar',
  closeResult: 'Cerrar',
  howDidItEnd: '¿Cómo terminó?',
  outcomePlayed: 'Jugado',
  outcomeRetired: 'Retiro',
  outcomeWalkover: 'Walkover',
  outcomeDefault: 'Default',
  whoCarriedOn: '¿Quién siguió?',
  whoAwarded: '¿A quién se le otorga el partido?',
  setN: 'Set {n}',
  saveResult: 'Guardar resultado',
  saving: 'Guardando…',
  cancel: 'Cancelar',
  undo: 'Deshacer',
  undoing: 'Deshaciendo…',
  clearResult: 'Borrar',
  clearing: 'Borrando…',
  gamesAria: 'Juegos de {name}, set {n}',
  tiebreakAria: 'Puntos de tiebreak de {name}, set {n}',
  drawKeyboardHint: 'Cuadro. Usa las flechas para moverte entre partidos.',
  zoomOut: 'Alejar',
  zoomIn: 'Acercar',
  orderOfPlay: 'Orden de juego',
  orderOfPlayLead:
    'Imprime esto para el muro del club. Vuelve a imprimirlo cuando cambien los horarios.',
  orderOfPlayEmptyLead:
    'Todavía no hay ningún partido con horario. Define los horarios de las canchas en la página de programación y luego programa los cuadros.',
  nothingScheduled: 'No hay nada programado.',
  notScheduled: 'sin horario',
  unscheduled1: 'Todavía hay 1 partido sin horario y no aparece en esta lista.',
  unscheduledN: 'Todavía hay {n} partidos sin horario y no aparecen en esta lista.',
  signOut: 'Cerrar sesión',
  signedInAs: 'Sesión iniciada como {email}',
  permissionDenied: 'Tu cuenta ({role}) no puede {action}.',
  askOwner: 'Si lo necesitas, pídeselo a quien administra el club.',
  denialDeleteTournament: 'eliminar un torneo',
  denialManageTournaments: 'crear o cambiar torneos',
  denialManageDraws: 'administrar cuadros',
  denialChangeEntrants: 'cambiar inscritos',
  denialRecordScores: 'registrar resultados',
  denialManageContent: 'editar el contenido del club',
  denialManageScorekeepers: 'administrar enlaces para anotadores',
  denialMergePlayers: 'unir jugadores',
  newTournament: 'Nuevo torneo',
  updatesAndMedia: 'Blog y galería',
  players: 'Jugadores',
  categories: 'Categorías',
  noTournamentsYet: 'Todavía no hay torneos.',
  draftLabel: 'Borrador',
  manage: 'Administrar',
  schedule: 'Programar',
  viewPublic: 'Ver página pública',
  details: 'Detalles',
  tournamentName: 'Nombre',
  tournamentNameExample: 'Torneo de ejemplo',
  starts: 'Empieza',
  ends: 'Termina',
  runConsolation: 'Jugar un cuadro de consolación',
  runConsolationHint:
    'Quienes pierdan su primer partido pasan a un segundo cuadro más pequeño, para que nadie viaje por un solo partido. Aplica a los cuadros de eliminación directa cuando los generes. Decide ahora: no se puede agregar a un cuadro ya generado.',
  creating: 'Creando…',
  createTournament: 'Crear torneo',
  courts: 'Canchas',
  courtsAvailable: 'Canchas disponibles',
  minutesPerMatch: 'Minutos por partido',
  restBetweenMatches: 'Descanso entre partidos',
  playingHours: 'Horarios de juego',
  leaveSessionBlank: 'Deja en blanco el horario en que no se juega.',
  noStartDate: 'Este torneo no tiene fecha de inicio, así que la programación empieza hoy.',
  scheduleStarts: 'La programación empieza el {date}.',
  weekdayMorning: 'Lunes a viernes por la mañana',
  weekdayEvening: 'Lunes a viernes por la tarde',
  weekend: 'Sábado y domingo',
  slotsAvailablePerWeek: 'horarios disponibles por semana.',
  scheduling: 'Programando…',
  saveAndGenerateSchedule: 'Guardar y generar programación',
  backToTournaments: 'Volver a torneos',
  scheduleTitle: 'Canchas y programación',
  scheduleCourtsRangeError: 'El número de canchas debe estar entre 1 y 40.',
  scheduleMinMatchDurationError: 'Cada partido debe durar al menos 15 minutos.',
  scheduleNoDraws: 'Genera un cuadro antes de programar los partidos.',
  scheduleSummary: '{scheduled} de {total} {matches} en {courts} canchas durante {days} días',
  scheduleFinalsWithin: '; las finales quedan dentro de {days} días entre sí.',
  scheduleUnplaced1: '1 partido no se pudo programar en {days} días.',
  scheduleUnplacedN: '{n} partidos no se pudieron programar en {days} días.',
  scheduleSpread:
    'Las finales quedan repartidas en {days} días. Agrega canchas u horarios para acercarlas.',
  entriesTitle: 'Inscripciones',
  qrCodesTitle: 'Códigos QR',
  drawSheetsTitle: 'Hojas de cuadro',
  scorekeepersTitle: 'Anotadores',
  newUpdateTitle: 'Nueva novedad',
  editUpdateTitle: 'Editar novedad',
  manageTournamentTitle: 'Administrar torneo',
  scheduled: 'programados',
  status: 'Estado',
  phaseSetup: 'Preparación',
  phaseEntries: 'Inscripciones abiertas',
  phaseDraws: 'Cuadros',
  phasePlay: 'En juego',
  phaseDone: 'Terminado',
  phaseCancelled: 'Cancelado',
  tournamentProgress: 'Avance del torneo',
  manageChooseCategories: 'Elige las categorías que vas a jugar',
  manageChooseCategoriesDetail:
    'Selecciona una casilla. No se pueden abrir inscripciones si no hay categorías.',
  openEntries: 'Abrir inscripciones',
  playersCanEnter: 'Después, los jugadores pueden inscribirse.',
  closeEntries: 'Cerrar inscripciones',
  noCategoriesChosen: 'Todavía no hay categorías. Agrega una antes de cerrar las inscripciones.',
  drawsReadyAfterFieldSettled: 'Cuando se cierre el grupo, ya puedes generar los cuadros.',
  fieldSettled: 'Las inscripciones están cerradas; el grupo ya quedó definido.',
  drawProgress: '{drawn} de {total} listos.',
  generateDraws: 'Generar los cuadros',
  generateAllDraws: 'Generar todos los cuadros',
  generating: 'Generando…',
  tickCellToRunCategory: 'Marca una casilla para incluir la categoría.',
  recordResults: 'Registrar resultados',
  matchesPlayed: '{played} de {total} partidos jugados.',
  markTournamentComplete: 'Marcar torneo como terminado',
  everyMatchHasResult: 'Todos los partidos tienen resultado.',
  finishedDrawsStayPublished: 'Terminado. Los cuadros siguen publicados.',
  tournamentCancelled: 'Este torneo se canceló.',
  working: 'Procesando…',
  entrantsSoFarShare: '{count} inscritos hasta ahora. Comparte este enlace:',
  mixedDivision: 'Mixta',
  divisionMensLabel: 'Masculino',
  divisionWomensLabel: 'Femenino',
  drawGrid: 'Cuadros',
  add: 'Agregar',
  formatFor: 'Formato para {category} {discipline}',
  entrantsShort: 'insc',
  matchesShort: 'part',
  drawn: 'Generado',
  notDrawn: 'Sin generar',
  entriesOpenLabel: 'Inscripciones abiertas',
  drawAction: 'Generar cuadro',
  reopen: 'Reabrir',
  removeDraw: 'Quitar categoría',
  exportResults: 'Exportar resultados',
  copy: 'Copiar',
  copied: 'Copiado',
  openLink: 'Abrir',
  statusAndVisibility: 'Estado y visibilidad',
  dangerZone: 'Zona de riesgo',
  stage: 'Etapa',
  statusDraft: 'Borrador',
  statusPublished: 'Publicado',
  statusInProgress: 'En curso',
  statusComplete: 'Terminado',
  statusCancelled: 'Cancelado',
  visibility: 'Visibilidad',
  hidden: 'Oculto',
  unlisted: 'Sin listar',
  publicLabel: 'Público',
  visibilityHiddenHint: 'Oculto: nadie puede ver este torneo ni sus cuadros.',
  visibilityUnlistedHint:
    'Sin listar: se puede abrir con el enlace, pero no aparece en la página de inicio.',
  visibilityPublicHint: 'Público: aparece en la página de inicio.',
  viewPublicPage: 'Ver página pública',
  pendingEntries: 'pendientes',
  handledEntries: 'respondidas',
  openButNotPublic:
    'Las inscripciones están abiertas, pero este torneo todavía no aparece en la página de inicio. Comparte el enlace de inscripción, o publícalo en Estado y visibilidad.',
  generateRemainingDraws: 'Generar las {n} que faltan',
  allDrawsGenerated: 'Todos los cuadros están generados.',
  updatesTitle: 'Blog',
  edit: 'Editar',
  publish: 'Publicar',
  unpublish: 'Quitar de publicación',
  view: 'Ver',
  deleteLabel: 'Eliminar',
  clearResultConsequence:
    'Se borra el marcador y el partido vuelve a quedar sin jugar. También se vacía el lugar que alimenta en la siguiente ronda.',
  revokeLinkConsequence:
    'El enlace actual deja de funcionar de inmediato. A quien lo esté usando en la cancha se le cerrará la sesión a media partido.',
  replaceLink: 'Reemplazar enlace',
  replaceLinkConsequence:
    'El enlace actual dejará de funcionar en cuanto se cree el nuevo. El enlace nuevo se muestra una sola vez.',
  rejectEntryConsequence:
    'Este jugador no quedará en el cuadro. No se le avisa automáticamente: tendrás que decírselo tú.',
  rejectCountN: 'Vas a rechazar {n} inscripciones.',
  hideTournamentConsequence:
    'El torneo sale de la página de inicio y sus páginas públicas dejan de abrir. Los códigos QR impresos no funcionarán hasta que lo vuelvas a publicar.',
  deleteUpdateConsequence: 'Se elimina el artículo. Esto no se puede deshacer.',
  unpublishUpdateConsequence:
    'El artículo sale del sitio público. Quien tenga el enlace verá la página de no encontrado.',
  publishUpdateConsequence: 'El artículo se publica en el sitio público de inmediato.',
  entriesWaitHere: 'Aquí quedan las inscripciones pendientes hasta que las aceptes',
  entriesGoStraightToDraw: 'Las inscripciones se aceptan automáticamente',
  entriesReviewOnHint:
    'Nadie entra al cuadro hasta que lo aceptes. Los jugadores sí reciben su confirmación.',
  entriesReviewOffHint:
    'Así lo pidió el club. Activa la revisión si empieza a llegar correo no deseado.',
  turnReviewOff: 'Desactivar revisión',
  turnReviewOn: 'Activar revisión',
  noEntriesYet:
    'Todavía no hay inscripciones. Comparte el enlace o el código QR y aparecerán aquí.',
  waitingForYou: 'Pendientes de revisar',
  alreadyReviewed: 'Ya respondidas',
  acceptedEntries: 'Aceptados',
  rejectedEntries: 'Rechazados',
  acceptedAppearOnGenerate:
    'Los inscritos aceptados aparecerán en el cuadro cuando se genere.',
  selectedCount: '{count} seleccionadas',
  nothingSelected: 'No hay ninguna seleccionada',
  accepting: 'Aceptando…',
  acceptSelected: 'Aceptar seleccionadas',
  rejectSelected: 'Rechazar seleccionadas',
  selectAll: 'Seleccionar todas',
  move: 'moverse',
  select: 'seleccionar',
  accept: 'aceptar',
  reject: 'rechazar',
  selectEntry: 'Seleccionar a {name}',
  withPartner: 'con {partner}',
  via: 'por {source}',
  accepted: 'aceptada',
  rejected: 'rechazada',
  scorekeepersLead:
    'Dale un enlace a quien vaya a anotar los resultados del torneo desde su teléfono. No necesita cuenta ni contraseña, y puedes revocar el acceso al terminar el fin de semana.',
  activeLink: 'enlace activo',
  activeLinks: 'enlaces activos',
  scorekeeperExample: 'Marco, Cancha 1–2',
  scorekeeperForLabel: '¿Para quién es este enlace?',
  createLink: 'Crear enlace',
  creatingLink: 'Creando…',
  noScorekeeperLinks: 'Todavía no hay enlaces.',
  linkCreatedFor: 'Enlace creado para {label}. Cópialo ahora; no se volverá a mostrar.',
  scorekeeperLink: 'Enlace para anotar',
  created: 'creado {date}',
  neverUsed: 'nunca usado',
  lastUsed: 'último uso {date}',
  revoked: 'revocado',
  revoke: 'Revocar',
  scorekeeperPermissions:
    'Quien tenga el enlace puede registrar, borrar y deshacer resultados solo en este torneo. No puede cambiar cuadros, inscritos ni nada más.',
  scorekeeperMissingLabel: 'Ponle nombre al enlace para saber a quién se lo diste.',
  scorekeeperTournamentNotFound: 'No encontramos el torneo.',
  registrationTitle: 'Inscripciones',
  entriesOpenShare:
    'Las inscripciones están abiertas. Comparte este enlace; los jugadores se inscriben y aparecen aquí.',
  entriesClosedHidden:
    'Las inscripciones están cerradas y el torneo está oculto, así que nadie puede abrir el enlace. Abre las inscripciones para empezar a recibir gente.',
  entriesClosedLinkStillWorks:
    'Las inscripciones están cerradas. El enlace lo indica, así que el cartel no deja a nadie sin respuesta.',
  linkNotLive: 'Este enlace todavía no está activo.',
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
