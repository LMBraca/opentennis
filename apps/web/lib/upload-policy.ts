/**
 * RV-16 — who may upload an image, as a rule rather than an inline check.
 *
 * In `lib` for the same reason `match-result.ts` is: it is the whole
 * security boundary on `/api/blob/upload`, and a boundary that cannot be
 * tested without standing up a request does not get tested.
 *
 * It matters more than it looks. `handleUpload` resolves the blob store
 * token BEFORE it calls `onBeforeGenerateToken`, so against an
 * unconfigured store the route fails on the missing token and this never
 * runs — an end-to-end "can a stranger upload?" test passes for entirely
 * the wrong reason. The rule is asserted directly instead.
 */

import { can, type MemberRole } from '@opentennis/db';

export function mayUpload(role: MemberRole | null): boolean {
  return role !== null && can(role, 'content:manage');
}
