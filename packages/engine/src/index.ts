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
  ScoringFormat,
  SeedingMode,
  SetScore,
  SourceRef,
  StageKind,
} from './types.js';

export { EngineError, engineError } from './errors.js';
export type { EngineErrorCode } from './errors.js';
