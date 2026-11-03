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
} from './types.js';

export { EngineError, engineError } from './errors.js';
export type { EngineErrorCode } from './errors.js';

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
} from './bracket.js';

export { createRng } from './random.js';
export type { Rng } from './random.js';

export {
  DEFAULT_GEOMETRY,
  layoutBracket,
  nodeIndex,
  pitchFor,
  xFor,
  yFor,
} from './geometry.js';
export type {
  BracketLayout,
  Connector,
  GeometryOptions,
  LaidOutNode,
} from './geometry.js';

export { generateSingleElimination, matchIdFor } from './single-elimination.js';
export type { SingleEliminationConfig } from './single-elimination.js';

export {
  MAX_ROUND_ROBIN_SIZE,
  MIN_ROUND_ROBIN_SIZE,
  circleRounds,
  generateRoundRobin,
  roundRobinMatchCount,
} from './round-robin.js';
export type { RoundRobinConfig } from './round-robin.js';

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
} from './scoring.js';
export type { MatchScoreSummary, ScoringPresetName, SetGames } from './scoring.js';

export {
  DEFAULT_POINTS,
  computeStandings,
  headToHead,
  headToHeadKey,
  recordFor,
} from './standings.js';
export type {
  EntrantRecord,
  MatchResultInput,
  PointsScheme,
  StandingsConfig,
  StandingsTable,
} from './standings.js';

export { explainOrdering, rankStandings } from './tiebreakers.js';
export type {
  RankedStanding,
  RankedTable,
  RankingConfig,
  TiebreakRule,
  TiebreakStep,
} from './tiebreakers.js';

export { applyWithdrawals } from './withdrawals.js';
export type {
  WithdrawalAction,
  WithdrawalAdjustment,
  WithdrawalConfig,
  WithdrawalResult,
} from './withdrawals.js';

export {
  generateHybrid,
  groupIdFor,
  groupNameFor,
  rankAcrossGroups,
  snakeAssign,
} from './hybrid.js';
export type {
  CrossGroupEntry,
  CrossGroupInput,
  CrossGroupResult,
  HybridConfig,
  HybridResult,
} from './hybrid.js';

export { article, plural } from './prose.js';
