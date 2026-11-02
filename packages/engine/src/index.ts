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
