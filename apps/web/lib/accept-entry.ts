import 'server-only';

/**
 * Turning a submission into an entrant.
 *
 * This is the ONLY place that creates players and entrants from a public
 * entry, and it exists so that both paths use identical logic: a club with
 * review switched off accepts automatically the moment the form is
 * submitted, and a club with it on accepts when an organizer presses the
 * button. Two implementations of "accept" would drift, and the one that
 * drifted would be the one nobody tested.
 *
 * `entrySubmissions` is the record of what was typed; `entrants` is the
 * draw. Keeping both means an accepted entry can still be traced back to
 * the form that produced it, and a rejected one leaves evidence rather than
 * vanishing.
 */

import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db } from './db';

/** "Ana María Vandenberg" → first "Ana María", last "Vandenberg". */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] ?? '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1] ?? '',
  };
}

export interface AcceptResult {
  readonly entrantId?: string;
  readonly error?: string;
}

/**
 * Create the entrant for a submission.
 *
 * Idempotent by email within the draw: accepting twice — a double-click, or
 * a retry — returns the entrant that already exists rather than putting the
 * same person in the draw twice.
 */
export async function acceptSubmission(
  submissionId: string,
  reviewerUserId: string | null,
): Promise<AcceptResult> {
  const rows = await db()
    .select()
    .from(schema.entrySubmissions)
    .where(eq(schema.entrySubmissions.id, submissionId))
    .limit(1);

  const submission = rows[0];
  if (submission === undefined) return { error: 'That entry no longer exists.' };
  if (submission.status === 'rejected') return { error: 'That entry was rejected.' };

  const selections = submission.selections as { eventId?: string; partnerName?: string };
  const eventId = selections.eventId ?? '';
  if (eventId === '') return { error: 'That entry has no draw attached.' };

  const events = await db()
    .select({ id: schema.events.id, discipline: schema.events.discipline })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1);
  const event = events[0];
  if (event === undefined) return { error: 'That draw no longer exists.' };

  const already = await db()
    .select({ id: schema.entrants.id })
    .from(schema.entrants)
    .where(
      and(
        eq(schema.entrants.eventId, eventId),
        eq(schema.entrants.contactEmail, submission.email),
      ),
    )
    .limit(1);

  if (already[0] !== undefined) {
    // Already in the draw. Mark the submission handled so the queue does not
    // keep offering it, and report success: the desired state is reached.
    await markReviewed(submissionId, 'accepted', reviewerUserId);
    return { entrantId: already[0].id };
  }

  const [entrant] = await db()
    .insert(schema.entrants)
    .values({
      organizationId: submission.organizationId,
      eventId,
      status: 'active',
      contactEmail: submission.email,
      contactPhone: submission.phone,
      sourceLabel: submission.sourceLabel,
      paid: false,
    })
    .returning({ id: schema.entrants.id });
  if (entrant === undefined) return { error: 'Could not create the entrant.' };

  const partner = (selections.partnerName ?? '').trim();
  const people =
    event.discipline === 'doubles' && partner !== ''
      ? [`${submission.firstName} ${submission.lastName}`.trim(), partner]
      : [`${submission.firstName} ${submission.lastName}`.trim()];

  for (const [position, person] of people.entries()) {
    const { firstName, lastName } = splitName(person);
    const [player] = await db()
      .insert(schema.players)
      .values({
        organizationId: submission.organizationId,
        firstName,
        lastName,
        // Only the person who filled the form gets their contact stored —
        // their partner never agreed to give us anything.
        email: position === 0 ? submission.email : null,
        phone: position === 0 ? submission.phone : null,
      })
      .returning({ id: schema.players.id });
    if (player === undefined) continue;
    await db()
      .insert(schema.entrantPlayers)
      .values({ entrantId: entrant.id, playerId: player.id, position });
  }

  await markReviewed(submissionId, 'accepted', reviewerUserId);
  return { entrantId: entrant.id };
}

export async function markReviewed(
  submissionId: string,
  status: 'accepted' | 'rejected',
  reviewerUserId: string | null,
  reason?: string,
): Promise<void> {
  await db()
    .update(schema.entrySubmissions)
    .set({
      status,
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
      ...(reason !== undefined ? { rejectionReason: reason.slice(0, 200) } : {}),
    })
    .where(eq(schema.entrySubmissions.id, submissionId));
}
