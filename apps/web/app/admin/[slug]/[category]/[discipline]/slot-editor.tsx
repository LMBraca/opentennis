'use client';

/**
 * ADM-12 — move an entrant into a specific first-round slot.
 *
 * Only the FIRST round is editable. Every later slot is filled by whoever
 * wins, so letting someone be placed in a semifinal would invent a result
 * that never happened.
 *
 * Each row is one side of one first-round match, with a dropdown of
 * everyone in the draw. Choosing somebody swaps the two — a move would
 * leave an empty slot and drop whoever was there.
 */

import { useActionState } from 'react';
import { swapSlots, type ActionState } from '../../../tournament-actions';
import styles from './entrants.module.css';

export interface SlotRow {
  readonly sideId: string;
  readonly matchLabel: string;
  readonly position: number;
  readonly entrantId: string | null;
}

export function SlotEditor({
  slug,
  eventId,
  slots,
  entrants,
  manuallyAdjusted,
  locked,
}: {
  readonly slug: string;
  readonly eventId: string;
  readonly slots: readonly SlotRow[];
  readonly entrants: ReadonlyArray<{ id: string; name: string }>;
  readonly manuallyAdjusted: boolean;
  /** True once a result exists — the draw can no longer be rearranged. */
  readonly locked: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(swapSlots, {});

  if (slots.length === 0) return null;

  return (
    <section className={styles.slots}>
      <h2 className={styles.slotsTitle}>First-round placement</h2>
      <p className={styles.slotsHint}>
        {locked
          ? 'A result has been recorded, so the draw can no longer be rearranged. Clear it first.'
          : 'Choosing a different entrant swaps the two. Useful when the random draw puts two club-mates together in round one.'}
      </p>

      {manuallyAdjusted && (
        <p className={styles.slotsHint}>
          This draw has been adjusted by hand, so it is no longer exactly what the generator
          produced.
        </p>
      )}

      <ul className={styles.slotList}>
        {slots.map((slot) => (
          <li key={slot.sideId} className={styles.slotRow}>
            <span className={styles.slotLabel}>
              {slot.matchLabel}
              <span className={styles.slotPosition}>{slot.position === 0 ? 'top' : 'bottom'}</span>
            </span>
            <form action={action} className={styles.slotForm}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="sideId" value={slot.sideId} />
              <select
                className={styles.select}
                name="entrantId"
                defaultValue={slot.entrantId ?? ''}
                aria-label={`Who is in ${slot.matchLabel}, ${slot.position === 0 ? 'top' : 'bottom'}?`}
                disabled={locked}
              >
                <option value="">—</option>
                {entrants.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button className={styles.ghost} type="submit" disabled={locked || pending}>
                Move
              </button>
            </form>
          </li>
        ))}
      </ul>

      {state.error !== undefined && <p className={styles.csvError}>{state.error}</p>}
      {state.ok !== undefined && <p className={styles.csvOk}>{state.ok}</p>}
    </section>
  );
}
