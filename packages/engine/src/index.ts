/**
 * @opentennis/engine
 *
 * Pure tournament draw engine: entrants and a config in, tournament structure
 * out. No database, no network, no framework, no dependencies.
 *
 * Contract: docs/tournament-formats.md
 */

export type {
  Entrant,
  EntrantId,
  EntrantStatus,
  GeneratedGroup,
  GeneratedMatch,
  GeneratedRound,
  GeneratedStage,
  GenerationMeta,
  GroupId,
  MatchId,
  MatchOutcome,
  MatchSide,
  MatchStatus,
  RoundKind,
  ScoringFormat,
  SeedingMode,
  SetScore,
  SourceRef,
  StageKind,
} from './types';

export { EngineError, engineError } from './errors';
export type { EngineErrorCode } from './errors';

export {
  MAX_DRAW_SIZE,
  MIN_DRAW_SIZE,
  bracketSizeFor,
  byeCountFor,
  firstRoundPairs,
  isPowerOfTwo,
  roundCountFor,
  roundNameFor,
  seedOrder,
  seedPositions,
} from './bracket';

export { createRng } from './random';
export type { Rng } from './random';

export {
  DEFAULT_GEOMETRY,
  layoutBracket,
  nodeIndex,
  pitchFor,
  xFor,
  yFor,
} from './geometry';
export type {
  BracketLayout,
  Connector,
  GeometryOptions,
  LaidOutNode,
} from './geometry';

export { generateSingleElimination, matchIdFor } from './single-elimination';
export type { SingleEliminationConfig } from './single-elimination';

export {
  MAX_ROUND_ROBIN_SIZE,
  MIN_ROUND_ROBIN_SIZE,
  circleRounds,
  generateRoundRobin,
  roundRobinMatchCount,
} from './round-robin';
export type { RoundRobinConfig } from './round-robin';

export {
  ADVANTAGE_BEST_OF_3,
  BEST_OF_3,
  BEST_OF_3_MATCH_TIEBREAK,
  BEST_OF_5,
  FAST4,
  MATCH_TIEBREAK_TO,
  PRO_SET_8,
  SCORING_PRESETS,
  SINGLE_SET_6,
  isCompletedMatchTiebreak,
  isCompletedSet,
  isDecidingSetIndex,
  isValidTiebreak,
  setWinner,
  summariseMatch,
  toSetGames,
  validateScoringFormat,
} from './scoring';
export type { MatchScoreSummary, ScoringPresetName, SetGames } from './scoring';

export {
  DEFAULT_POINTS,
  computeStandings,
  headToHead,
  headToHeadKey,
  recordFor,
} from './standings';
export type {
  EntrantRecord,
  MatchResultInput,
  PointsScheme,
  StandingsConfig,
  StandingsTable,
} from './standings';

export { explainOrdering, rankStandings } from './tiebreakers';
export type {
  RankedStanding,
  RankedTable,
  RankingConfig,
  TiebreakRule,
  TiebreakStep,
} from './tiebreakers';

export { applyWithdrawals } from './withdrawals';
export type {
  WithdrawalAction,
  WithdrawalAdjustment,
  WithdrawalConfig,
  WithdrawalResult,
} from './withdrawals';

export {
  generateHybrid,
  groupIdFor,
  groupNameFor,
  rankAcrossGroups,
  snakeAssign,
} from './hybrid';
export type {
  CrossGroupEntry,
  CrossGroupInput,
  CrossGroupResult,
  HybridConfig,
  HybridResult,
} from './hybrid';

export { article, plural } from './prose';

export {
  DEFAULT_SCHEDULING,
  generateSlots,
  scheduleMatches,
  validateSchedulingConfig,
  weeklyCapacity,
} from './scheduling';
export type {
  MinuteOfDay,
  SchedulableMatch,
  ScheduleResult,
  ScheduledMatch,
  SchedulingConfig,
  Slot,
  TimeWindow,
} from './scheduling';
