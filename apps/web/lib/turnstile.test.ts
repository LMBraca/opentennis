import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readVerifyResponse,
  turnstileConfigured,
  turnstileSiteKey,
  verifyTurnstile,
} from './turnstile';

const SITE = 'NEXT_PUBLIC_TURNSTILE_SITE_KEY';
const SECRET = 'TURNSTILE_SECRET_KEY';

describe('configuration', () => {
  beforeEach(() => {
    delete process.env[SITE];
    delete process.env[SECRET];
  });
  afterEach(() => {
    delete process.env[SITE];
    delete process.env[SECRET];
  });

  it('is unconfigured with no keys', () => {
    expect(turnstileConfigured()).toBe(false);
    expect(turnstileSiteKey()).toBeNull();
  });

  it('treats blank keys as unset, not as a gate', () => {
    process.env[SITE] = '   ';
    process.env[SECRET] = '';
    expect(turnstileConfigured()).toBe(false);
  });

  it('needs BOTH halves — one alone is a misconfiguration', () => {
    process.env[SITE] = 'site';
    expect(turnstileConfigured()).toBe(false);
    delete process.env[SITE];
    process.env[SECRET] = 'secret';
    expect(turnstileConfigured()).toBe(false);
  });

  it('is configured with both', () => {
    process.env[SITE] = 'site';
    process.env[SECRET] = 'secret';
    expect(turnstileConfigured()).toBe(true);
  });
});

describe('verifyTurnstile when unconfigured', () => {
  beforeEach(() => {
    delete process.env[SITE];
    delete process.env[SECRET];
  });

  it('lets the entry through, so an unkeyed club still takes entries', async () => {
    const out = await verifyTurnstile(null, '1.2.3.4');
    expect(out).toEqual({ ok: true, reason: 'not-configured' });
  });

  it('does not even require a token', async () => {
    expect((await verifyTurnstile('', null)).ok).toBe(true);
  });
});

describe('verifyTurnstile when configured', () => {
  beforeEach(() => {
    process.env[SITE] = 'site';
    process.env[SECRET] = 'secret';
  });
  afterEach(() => {
    delete process.env[SITE];
    delete process.env[SECRET];
  });

  it('REJECTS a missing token — this is the case the feature exists for', async () => {
    expect(await verifyTurnstile(null, '1.2.3.4')).toEqual({
      ok: false,
      reason: 'missing-token',
    });
  });

  it('rejects a whitespace-only token', async () => {
    expect((await verifyTurnstile('   ', null)).reason).toBe('missing-token');
  });
});

describe('readVerifyResponse', () => {
  it('accepts a success', () => {
    expect(readVerifyResponse({ success: true })).toEqual({ ok: true, reason: 'verified' });
  });

  it('rejects a failure and keeps the codes for the log', () => {
    const out = readVerifyResponse({
      success: false,
      'error-codes': ['invalid-input-response'],
    });
    expect(out.ok).toBe(false);
    expect(out.errorCodes).toEqual(['invalid-input-response']);
  });

  it('does not treat a truthy non-true as success', () => {
    // A body of {success:"true"} is not a pass.
    expect(readVerifyResponse({ success: 'true' }).ok).toBe(false);
  });

  it('fails OPEN on a body it cannot read, rather than blocking real entrants', () => {
    for (const junk of [null, 'ok', 42]) {
      expect(readVerifyResponse(junk)).toEqual({ ok: true, reason: 'unreachable' });
    }
  });

  it('tolerates missing error-codes', () => {
    expect(readVerifyResponse({ success: false }).errorCodes).toEqual([]);
  });
});
