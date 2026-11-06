import { describe, expect, it } from 'vitest';
import { hashScorekeeperToken, looksLikeToken } from './scorekeeper';

describe('hashScorekeeperToken', () => {
  it('is stable for the same token', () => {
    expect(hashScorekeeperToken('abc')).toBe(hashScorekeeperToken('abc'));
  });

  it('differs for different tokens', () => {
    expect(hashScorekeeperToken('abc')).not.toBe(hashScorekeeperToken('abd'));
  });

  it('never returns the token itself — a leaked row must not be replayable', () => {
    const token = 'a-very-secret-token-value';
    const hash = hashScorekeeperToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('looksLikeToken', () => {
  it('accepts a base64url token of the length we mint', () => {
    // 24 random bytes -> 32 base64url characters.
    expect(looksLikeToken('A'.repeat(32))).toBe(true);
    expect(looksLikeToken('abcXYZ012_-'.padEnd(32, 'q'))).toBe(true);
  });

  it('rejects the junk a crawler sends, before it costs a query', () => {
    for (const junk of [
      '',
      'favicon.ico',
      '../../etc/passwd',
      'short',
      'has spaces in it and is long enough',
      `${'A'.repeat(65)}`,
      'contains+slash/and=padding',
    ]) {
      expect(looksLikeToken(junk)).toBe(false);
    }
  });

  it('rejects base64 padding and the non-url alphabet', () => {
    expect(looksLikeToken(`${'A'.repeat(30)}==`)).toBe(false);
    expect(looksLikeToken(`${'A'.repeat(30)}+/`)).toBe(false);
  });
});
