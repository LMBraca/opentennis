import { describe, expect, it } from 'vitest';
import { EngineError, engineError } from './errors';

describe('EngineError', () => {
  it('carries a machine-readable code so the app layer can branch on it', () => {
    const err = engineError('TOO_FEW_ENTRANTS', 'Need at least 2 entrants', { count: 1 });

    expect(err).toBeInstanceOf(EngineError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('TOO_FEW_ENTRANTS');
    expect(err.message).toBe('Need at least 2 entrants');
    expect(err.details).toEqual({ count: 1 });
  });

  it('defaults details to an empty object rather than undefined', () => {
    expect(engineError('DUPLICATE_SEED', 'Seed 3 used twice').details).toEqual({});
  });

  it('is throwable and catchable as an EngineError', () => {
    expect(() => {
      throw engineError('TOO_MANY_ENTRANTS', 'Draw sizes above 128 are not supported');
    }).toThrow(EngineError);
  });
});
