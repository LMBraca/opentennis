'use client';

/**
 * The only way to undo a generated draw.
 *
 * It lives here, on the draw's own page, rather than in the grid where the
 * old regenerate button sat. That button was one click away from "Entrants",
 * took no confirmation, and silently deleted the bracket and every result
 * under it. Making it harder to reach is most of the fix; the typed
 * confirmation and the server-side refusal are the rest.
 *
 * Renders nothing at all until a draw exists — there is no sense offering to
 * delete something that has not been made.
 */

import { useActionState } from 'react';
import { redrawEvent, type ActionState } from '../../../tournament-actions';
import styles from './entrants.module.css';

export function RedrawPanel({
  slug,
  eventId,
  label,
  matchCount,
  playedCount,
}: {
  readonly slug: string;
  readonly eventId: string;
  /** "C+ Singles" — also the phrase that has to be typed to confirm. */
  readonly label: string;
  readonly matchCount: number;
  readonly playedCount: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(redrawEvent, {});

  if (matchCount === 0) return null;

  return (
    <section className={styles.redraw}>
      <h2 className={styles.redrawTitle}>Replace this draw</h2>

      {playedCount > 0 ? (
        <p className={styles.redrawHint}>
          {playedCount} {playedCount === 1 ? 'match has' : 'matches have'} a result.
          This draw cannot be replaced until those results are cleared, on the results
          page. Entrants and seeds would survive; the scores would not.
        </p>
      ) : (
        <>
          <p className={styles.redrawHint}>
            Deletes the {matchCount} {matchCount === 1 ? 'match' : 'matches'} in this draw
            so it can be generated again. Entrants and seeds are kept. No results have
            been entered, so nothing else is lost.
          </p>
          <form action={action} className={styles.redrawForm}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="expectedLabel" value={label} />
            <input
              className={styles.input}
              name="confirmLabel"
              placeholder={label}
              aria-label={`Type "${label}" to confirm`}
              autoComplete="off"
              required
            />
            <button className={styles.redrawButton} type="submit" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete draw'}
            </button>
          </form>
        </>
      )}

      {state.error !== undefined && <p className={styles.redrawError}>{state.error}</p>}
      {state.ok !== undefined && <p className={styles.redrawOk}>{state.ok}</p>}
    </section>
  );
}
