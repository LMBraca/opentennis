/**
 * ENT-3 — Cloudflare Turnstile.
 *
 * The last layer on the public entry form, behind the honeypot, the
 * two-second human floor and the per-IP rate limit. Those stop a naive
 * script; this is what stops someone who bothered to look at the form.
 *
 * UNCONFIGURED IS A VALID STATE, and the most important decision here. With
 * no keys set, verification is skipped and the form works exactly as before.
 * The alternative — failing closed — means the day the club's keys expire or
 * get rotated, every entry silently bounces during a tournament, and the
 * only symptom is "nobody can sign up". A spam gate that takes the entry
 * form down with it is worse than the spam.
 *
 * Failing OPEN on a network error to Cloudflare is the same trade for the
 * same reason: the siteverify call is a dependency the club does not
 * control, sitting in front of the one page that earns them entries.
 */

import 'server-only';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
/** Cloudflare is usually tens of ms; past this, let the entry through. */
const TIMEOUT_MS = 4000;

export interface TurnstileOutcome {
  readonly ok: boolean;
  /** Why it passed or failed — for logs and tests, never shown to a person. */
  readonly reason:
    | 'not-configured'
    | 'verified'
    | 'missing-token'
    | 'rejected'
    | 'unreachable';
  readonly errorCodes?: readonly string[];
}

export function turnstileSiteKey(): string | null {
  const key = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
  return key === undefined || key.trim() === '' ? null : key.trim();
}

export function turnstileSecretKey(): string | null {
  const key = process.env['TURNSTILE_SECRET_KEY'];
  return key === undefined || key.trim() === '' ? null : key.trim();
}

/** Both halves are needed; one alone is a misconfiguration, not a gate. */
export function turnstileConfigured(): boolean {
  return turnstileSiteKey() !== null && turnstileSecretKey() !== null;
}

/**
 * Read a siteverify response without trusting its shape.
 *
 * Split out from the fetch so the decision itself is testable — the part
 * that can be wrong in a way that either lets spam through or locks real
 * entrants out.
 */
export function readVerifyResponse(body: unknown): TurnstileOutcome {
  if (body === null || typeof body !== 'object') {
    return { ok: true, reason: 'unreachable' };
  }
  const raw = body as Record<string, unknown>;
  if (raw['success'] === true) return { ok: true, reason: 'verified' };

  const codes = Array.isArray(raw['error-codes'])
    ? raw['error-codes'].filter((c): c is string => typeof c === 'string')
    : [];
  return { ok: false, reason: 'rejected', errorCodes: codes };
}

export async function verifyTurnstile(
  token: string | null,
  remoteIp: string | null,
): Promise<TurnstileOutcome> {
  const secret = turnstileSecretKey();
  if (secret === null || turnstileSiteKey() === null) {
    return { ok: true, reason: 'not-configured' };
  }

  // Configured but no token: the widget did not run or was stripped. That is
  // the case this feature exists for, so it fails closed.
  if (token === null || token.trim() === '') {
    return { ok: false, reason: 'missing-token' };
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp !== null && remoteIp !== 'local') form.set('remoteip', remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: true, reason: 'unreachable' };
    return readVerifyResponse(await res.json());
  } catch {
    return { ok: true, reason: 'unreachable' };
  }
}
