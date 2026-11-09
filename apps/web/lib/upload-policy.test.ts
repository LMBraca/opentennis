import { describe, expect, it } from 'vitest';
import { mayUpload } from './upload-policy';

/**
 * The only defence on /api/blob/upload. Without it, anyone who finds the
 * URL can upload anything and have it served from the club's own domain.
 */
describe('mayUpload', () => {
  it('refuses a request with no session', () => {
    expect(mayUpload(null)).toBe(false);
  });

  it('refuses roles that do not manage content', () => {
    expect(mayUpload('viewer')).toBe(false);
    expect(mayUpload('scorekeeper')).toBe(false);
  });

  it('allows the roles that do', () => {
    expect(mayUpload('admin')).toBe(true);
    expect(mayUpload('owner')).toBe(true);
  });
})
