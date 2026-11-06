'use client';

/**
 * How this draw is scored, and how any one round differs.
 *
 * Until now these six columns were unreachable: the schema had them, the
 * engine honoured them, and no screen ever wrote them — so every draw played
 * on the defaults no matter what the club had agreed. This is the screen.
 *
 * Presets only, not six number boxes. The combinations that make sense are a
 * short list the engine already defines, and a free-form editor would mostly
 * produce formats nobody plays — "games to 6, tiebreak at 2" — that the
 * validator then rejects at the point of saving a score, which is far too
 * late to find out.
 */

import { useActionState } from 'react';
import { setEventScoring, setRoundScoring, type ActionState } from '../../../tournament-actions';
import styles from './entrants.module.css';

/** Keys are engine preset names; the engine owns the numbers. */
const PRESET_LABELS: Record<string, string> = {
  bestOf3: 'Best of 3, tiebreak at 6-6',
  bestOf3MatchTiebreak: 'Best of 3, 10-point match tiebreak in the third',
  bestOf5: 'Best of 5',
  proSet8: 'One pro set to 8',
  singleSet6: 'One set to 6',
  fast4: 'Fast4 — games to 4, no-ad',
  advantageBestOf3: 'Best of 3, advantage sets, no tiebreak',
};

export interface ScoringRound {
  readonly id: string;
  readonly name: string;
  readonly roundIndex: number;
  /** Preset the override corresponds to, '' for "same as the draw". */
  readonly preset: string;
  /** True when a format is stored that is not one of the presets. */
  readonly custom: boolean;
}

export function ScoringPanel({
  slug,
  eventId,
  drawPreset,
  drawCustom,
  rounds,
}: {
  readonly slug: string;
  readonly eventId: string;
  readonly drawPreset: string;
  readonly drawCustom: boolean;
  readonly rounds: readonly ScoringRound[];
}) {
  const [drawState, drawAction, drawPending] = useActionState<ActionState, FormData>(
    setEventScoring,
    {},
  );
  const [roundState, roundAction, roundPending] = useActionState<ActionState, FormData>(
    setRoundScoring,
    {},
  );

  return (
    <section className={styles.scoring}>
      <h2 className={styles.scoringTitle}>Scoring</h2>
      <p className={styles.scoringHint}>
        Applies to every match in this draw unless a round below says otherwise.
      </p>

      <form action={drawAction} className={styles.scoringForm}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={eventId} />
        <select
          className={styles.select}
          name="preset"
          defaultValue={drawPreset}
          aria-label="Scoring format for this draw"
        >
          {drawCustom && (
            <option value="" disabled>
              Custom — not one of the presets
            </option>
          )}
          {Object.entries(PRESET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className={styles.scoringSave} type="submit" disabled={drawPending}>
          {drawPending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {drawState.error !== undefined && <p className={styles.redrawError}>{drawState.error}</p>}
      {drawState.ok !== undefined && <p className={styles.redrawOk}>{drawState.ok}</p>}

      {rounds.length > 0 && (
        <>
          <h3 className={styles.scoringSub}>By round</h3>
          <p className={styles.scoringHint}>
            For a club that plays short early rounds and a full final. Leave a round on
            &quot;same as the draw&quot; unless it genuinely differs.
          </p>
          <ul className={styles.roundList}>
            {rounds.map((round) => (
              <li key={round.id} className={styles.roundRow}>
                <span className={styles.roundName}>{round.name}</span>
                <form action={roundAction} className={styles.roundForm}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="roundId" value={round.id} />
                  <select
                    className={styles.select}
                    name="preset"
                    defaultValue={round.preset}
                    aria-label={`Scoring format for ${round.name}`}
                  >
                    <option value="">Same as the draw</option>
                    {round.custom && (
                      <option value="" disabled>
                        Custom — not one of the presets
                      </option>
                    )}
                    {Object.entries(PRESET_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.scoringSave}
                    type="submit"
                    disabled={roundPending}
                  >
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {roundState.error !== undefined && (
            <p className={styles.redrawError}>{roundState.error}</p>
          )}
          {roundState.ok !== undefined && <p className={styles.redrawOk}>{roundState.ok}</p>}
        </>
      )}
    </section>
  );
}
