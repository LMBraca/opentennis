import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('password hashing', () => {
  it('round-trips a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('produces a different hash each time, so equal passwords are not detectable', async () => {
    const a = await hashPassword('same password here');
    const b = await hashPassword('same password here');
    expect(a).not.toBe(b);
    // Both still verify: the salt lives in the hash.
    expect(await verifyPassword('same password here', a)).toBe(true);
    expect(await verifyPassword('same password here', b)).toBe(true);
  });

  it('stores its work factors so they can be raised later', async () => {
    const hash = await hashPassword('a long enough password');
    const [algo, n, r, p] = hash.split('$');
    expect(algo).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it('requires length over composition', async () => {
    // A 10-character passphrase resists an offline attack better than "P@ss1!".
    await expect(hashPassword('short')).rejects.toThrow(/at least 10/);
  });

  it('rejects a malformed stored hash rather than throwing', async () => {
    for (const bad of ['', 'nonsense', 'bcrypt$1$2$3$4$5', 'scrypt$only$four$parts']) {
      expect(await verifyPassword('whatever', bad)).toBe(false);
    }
  });
});
