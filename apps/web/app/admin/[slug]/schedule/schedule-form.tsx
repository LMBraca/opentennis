'use client';

import { useActionState } from 'react';
import { saveAndSchedule, type ScheduleState } from './actions';
import styles from './schedule.module.css';

interface Band {
  readonly from: string;
  readonly to: string;
}

export function ScheduleForm({
  slug,
  startDate,
  courtCount,
  matchMinutes,
  minRestMinutes,
  weekdayAm,
  weekdayPm,
  weekend,
}: {
  readonly slug: string;
  readonly startDate: string | null;
  readonly courtCount: number;
  readonly matchMinutes: number;
  readonly minRestMinutes: number;
  readonly weekdayAm: Band;
  readonly weekdayPm: Band;
  readonly weekend: Band;
}) {
  const [state, action, pending] = useActionState<ScheduleState, FormData>(saveAndSchedule, {});

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="slug" value={slug} />

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Courts</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Courts available</span>
            <input
              className={styles.input}
              type="number"
              name="courtCount"
              min={1}
              max={40}
              defaultValue={courtCount}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Minutes per match</span>
            <input
              className={styles.input}
              type="number"
              name="matchMinutes"
              min={15}
              step={15}
              defaultValue={matchMinutes}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Rest between matches</span>
            <input
              className={styles.input}
              type="number"
              name="minRestMinutes"
              min={0}
              step={15}
              defaultValue={minRestMinutes}
              required
            />
          </label>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Playing hours</h2>
        <p className={styles.hint}>
          Leave a session blank if you do not play then.
          {startDate === null
            ? ' This tournament has no start date, so scheduling begins today.'
            : ` Scheduling starts ${startDate}.`}
        </p>

        <div className={styles.bands}>
          <fieldset className={styles.band}>
            <legend className={styles.bandName}>Mon–Fri morning</legend>
            <div className={styles.range}>
              <input className={styles.input} type="time" name="weekdayAmFrom" defaultValue={weekdayAm.from} />
              <span className={styles.dash}>–</span>
              <input className={styles.input} type="time" name="weekdayAmTo" defaultValue={weekdayAm.to} />
            </div>
          </fieldset>

          <fieldset className={styles.band}>
            <legend className={styles.bandName}>Mon–Fri evening</legend>
            <div className={styles.range}>
              <input className={styles.input} type="time" name="weekdayPmFrom" defaultValue={weekdayPm.from} />
              <span className={styles.dash}>–</span>
              <input className={styles.input} type="time" name="weekdayPmTo" defaultValue={weekdayPm.to} />
            </div>
          </fieldset>

          <fieldset className={styles.band}>
            <legend className={styles.bandName}>Sat &amp; Sun</legend>
            <div className={styles.range}>
              <input className={styles.input} type="time" name="weekendFrom" defaultValue={weekend.from} />
              <span className={styles.dash}>–</span>
              <input className={styles.input} type="time" name="weekendTo" defaultValue={weekend.to} />
            </div>
          </fieldset>
        </div>
      </section>

      {state.error !== undefined && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      {state.summary !== undefined && (
        <div className={styles.result} role="status">
          <p className={styles.resultLine}>{state.summary}</p>
          {state.perWeek !== undefined && (
            <p className={styles.resultMeta}>{state.perWeek} slots available per week.</p>
          )}
          {/* Warnings are shown, never swallowed: an organizer needs to know
              the plan did not fit before the Saturday, not during it. */}
          {(state.warnings ?? []).map((w) => (
            <p key={w} className={styles.warning}>
              {w}
            </p>
          ))}
        </div>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? 'Scheduling…' : 'Save and generate schedule'}
      </button>
    </form>
  );
}
