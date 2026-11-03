/**
 * The engine rejects impossible configurations loudly rather than degrading.
 * A draw that silently "works" with bad input is worse than one that refuses:
 * an organizer who finds one wrong bye placement stops trusting the whole tool.
 */

export type EngineErrorCode =
  | 'TOO_FEW_ENTRANTS'
  | 'TOO_MANY_ENTRANTS'
  | 'DUPLICATE_ENTRANT_ID'
  | 'DUPLICATE_SEED'
  | 'SEED_OUT_OF_RANGE'
  | 'INVALID_GROUP_COUNT'
  | 'INVALID_SCORING_FORMAT'
  | 'INVALID_QUALIFIER_COUNT'
  | 'INVALID_GEOMETRY'
  | 'WRONG_STAGE_KIND'
  | 'UNKNOWN_ENTRANT'
  | 'INCONSISTENT_RESULT'
  | 'INVALID_SCHEDULE';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: EngineErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.details = details;
  }
}

export function engineError(
  code: EngineErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): EngineError {
  return new EngineError(code, message, details);
}
