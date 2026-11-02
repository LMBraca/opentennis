/**
 * Core engine types.
 *
 * Three invariants govern everything in this package (docs/tournament-formats.md §1):
 *
 *   No-skill rule  — there is no rating anywhere. Seeds are integers an admin
 *                    typed, and are frequently all null. Every generation path
 *                    must work with a fully unseeded field; that is the common
 *                    case, not the edge case.
 *
 *   Category rule  — skill category (Open, A, B, C+, C, D) is NOT an engine
 *                    concept. The application decides which entrants belong to
 *                    which draw and calls the engine once per draw. Nothing here
 *                    may ever branch on a category.
 *
 *   Determinism    — every generator takes an explicit randomSeed. Same inputs
 *                    plus same seed produce identical output, always.
 */

export type EntrantId = string;
export type MatchId = string;
export type GroupId = string;

export type EntrantStatus = 'active' | 'withdrawn' | 'noShow';

/**
 * The draw's atomic unit. One player for singles, two for doubles — the engine
 * is deliberately blind to how many humans are inside one, and to which skill
 * category the draw belongs to.
 */
export interface Entrant {
  readonly id: EntrantId;
  /** 1-indexed. Admin-assigned or null. Never computed — there are no ratings. */
  readonly seed: number | null;
  readonly status: EntrantStatus;
  /**
   * Club affiliation. The only grouping signal the product has, used solely by
   * the optional same-club first-round avoidance constraint.
   */
  readonly clubId?: string | undefined;
}

/** Where a match side comes from when it is not yet decided. */
export type SourceRef =
  | { readonly kind: 'winnerOf'; readonly matchId: MatchId }
  | { readonly kind: 'loserOf'; readonly matchId: MatchId }
  | { readonly kind: 'groupRank'; readonly groupId: GroupId; readonly rank: number }
  | { readonly kind: 'bye' };

export interface MatchSide {
  readonly position: 0 | 1;
  /** Populated only when the entrant is known at generation time. */
  readonly entrantId: EntrantId | null;
  /** Points at the feeding match when the entrant is not yet known. */
  readonly sourceRef: SourceRef | null;
}

export type MatchStatus = 'pending' | 'bye';

export type MatchOutcome =
  | 'completed'
  | 'walkover'
  | 'retirement'
  | 'default'
  | 'unfinished';

export interface GeneratedMatch {
  /** Deterministic, engine-assigned. Stable for identical inputs. */
  readonly id: MatchId;
  readonly roundIndex: number;
  readonly slotIndex: number;
  readonly sides: readonly [MatchSide, MatchSide];
  readonly status: MatchStatus;
  readonly groupId?: GroupId | undefined;
}

/**
 * Rounds are not all equivalent. A third-place playoff sits outside the
 * elimination chain — it has no parent, its losers go nowhere, and a renderer
 * must not draw a connector out of it. Distinguishing it in data beats having
 * every consumer pattern-match on the round name.
 */
export type RoundKind = 'main' | 'thirdPlace';

export interface GeneratedRound {
  readonly index: number;
  /** "Final", "Semifinal", "Round of 16", "Third-place playoff". */
  readonly name: string;
  readonly kind: RoundKind;
  readonly groupId?: GroupId | undefined;
  readonly matches: readonly GeneratedMatch[];
  /**
   * Entrants not playing this round. Only ever populated for a round robin
   * with an odd field, where exactly one entrant sits out each round. The
   * scheduler needs this to avoid booking a court for someone who isn't
   * playing, and the public view needs it to say "resting" rather than
   * leaving a gap the reader has to interpret.
   */
  readonly idleEntrantIds?: readonly EntrantId[] | undefined;
}

export interface GeneratedGroup {
  readonly id: GroupId;
  /**
   * Pools are NUMBERED, never lettered — A/B/C+/C/D are skill categories, and
   * "Group B of the C+ draw" versus "the B draw" is how a player ends up on the
   * wrong court. Hard naming rule (docs/tournament-formats.md §4.1).
   */
  readonly name: string;
  readonly entrantIds: readonly EntrantId[];
}

export type SeedingMode = 'unseeded' | 'partial' | 'seeded';

/**
 * Why the draw looks the way it does. Surfaced verbatim in the admin draw
 * preview: an organizer needs to know whether the top-left name is there
 * because they are the top seed or because a dice roll put them there.
 */
export interface GenerationMeta {
  readonly seedingMode: SeedingMode;
  readonly entrantCount: number;
  readonly seededCount: number;
  readonly bracketSize: number | null;
  readonly byeCount: number;
  readonly byeRecipients: readonly EntrantId[];
  readonly randomSeed: string;
  /** Human-readable, for the UI. Never parsed. */
  readonly description: string;
}

export type StageKind = 'singleElimination' | 'roundRobin';

export interface GeneratedStage {
  readonly kind: StageKind;
  readonly rounds: readonly GeneratedRound[];
  readonly groups: readonly GeneratedGroup[];
  readonly meta: GenerationMeta;
}

/* ------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* ------------------------------------------------------------------------- */

export interface ScoringFormat {
  /** 2 for best-of-3, 3 for best-of-5, 1 for a single set or pro set. */
  readonly setsToWin: number;
  /** 6 standard, 8 pro set, 4 Fast4. */
  readonly gamesPerSet: number;
  /** Game count that triggers a tiebreak, or null for advantage sets. */
  readonly tiebreakAt: number | null;
  /** 7 standard, 10 for a match tiebreak. */
  readonly tiebreakTo: number;
  readonly decidingSetMode: 'standard' | 'matchTiebreak';
  /** false = no-ad (sudden death at 40-40). */
  readonly adScoring: boolean;
}

export interface SetScore {
  readonly index: number;
  readonly side0Games: number;
  readonly side1Games: number;
  readonly side0TiebreakPoints: number | null;
  readonly side1TiebreakPoints: number | null;
}
