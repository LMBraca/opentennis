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
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import styles from './entrants.module.css';

/** Keys are engine preset names; the engine owns the numbers. */
const PRESET_LABELS: Record<string, keyof Pick<
  Dictionary,
  | 'scoringBestOf3'
  | 'scoringBestOf3MatchTb'
  | 'scoringBestOf5'
  | 'scoringProSet8'
  | 'scoringSingleSet6'
  | 'scoringFast4'
  | 'scoringAdvantageBestOf3'
>> = {
  bestOf3: 'scoringBestOf3',
  bestOf3MatchTiebreak: 'scoringBestOf3MatchTb',
  bestOf5: 'scoringBestOf5',
  proSet8: 'scoringProSet8',
  singleSet6: 'scoringSingleSet6',
  fast4: 'scoringFast4',
  advantageBestOf3: 'scoringAdvantageBestOf3',
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
  dict,
}: {
  readonly slug: string;
  readonly eventId: string;
  readonly drawPreset: string;
  readonly drawCustom: boolean;
  readonly rounds: readonly ScoringRound[];
  readonly dict: Dictionary;
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
      <h2 className={styles.scoringTitle}>{dict.scoringTitle}</h2>
      <p className={styles.scoringHint}>
        {dict.scoringHint}
      </p>

      <form action={drawAction} className={styles.scoringForm}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={eventId} />
        <select
          className={styles.select}
          name="preset"
          defaultValue={drawPreset}
          aria-label={fill(dict.scoringFormatForRound, { name: dict.draw.toLowerCase() })}
        >
          {drawCustom && (
            <option value="" disabled>
              {dict.scoringCustomPreset}
            </option>
          )}
          {Object.entries(PRESET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {dict[label]}
            </option>
          ))}
        </select>
        <button className={styles.scoringSave} type="submit" disabled={drawPending}>
          {drawPending ? dict.saving : dict.save}
        </button>
      </form>
      {drawState.error !== undefined && <p className={styles.redrawError}>{drawState.error}</p>}
      {drawState.ok !== undefined && <p className={styles.redrawOk}>{drawState.ok}</p>}

      {rounds.length > 0 && (
        <>
          <h3 className={styles.scoringSub}>{dict.scoringByRound}</h3>
          <p className={styles.scoringHint}>
            {dict.scoringByRoundHint}
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
                    aria-label={fill(dict.scoringFormatForRound, { name: round.name })}
                  >
                    <option value="">{dict.sameAsDraw}</option>
                    {round.custom && (
                      <option value="" disabled>
                        {dict.scoringCustomPreset}
                      </option>
                    )}
                    {Object.entries(PRESET_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {dict[label]}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.scoringSave}
                    type="submit"
                    disabled={roundPending}
                  >
                    {dict.save}
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
