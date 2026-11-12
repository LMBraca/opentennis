'use client';

/**
 * Tournament settings.
 *
 * NOT a second copy of the create form, which is what the Configuración
 * link used to open. Create asks the few things needed to exist — a name
 * and some dates. Settings is the whole surface, grouped by what an
 * organizer is actually thinking about when they come looking: the event
 * itself, how people enter, how draws are made, how the day is scheduled.
 *
 * One form, one save. A dozen auto-submitting controls would mean a dozen
 * round trips and no way to change two related fields — the dates — without
 * the first save being briefly wrong.
 */

import { useActionState } from 'react';
import { saveTournamentSettings, type ActionState } from '../../tournament-actions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './settings.module.css';

export interface SettingsValues {
  readonly slug: string;
  readonly name: string;
  readonly venue: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly entriesOpen: boolean;
  readonly requireCaptcha: boolean;
  readonly consolationDraws: boolean;
  readonly courtCount: number;
  readonly matchMinutes: number;
  readonly minRestMinutes: number;
  /** Pesos, not cents — the form speaks the organizer's units. */
  readonly entryFee: string;
  readonly currency: string;
  /** False once any draw has been generated: changing it then does nothing. */
  readonly consolationEditable: boolean;
}

function Section({
  title,
  hint,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {hint !== undefined && <p className={styles.sectionHint}>{hint}</p>}
      </div>
      <div className={styles.fields}>{children}</div>
    </section>
  );
}

export function SettingsForm({
  values,
  dict,
}: {
  readonly values: SettingsValues;
  readonly dict: Dictionary;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveTournamentSettings,
    {},
  );

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="slug" value={values.slug} />

      <Section title={dict.settingsSectionEvent}>
        <label className={styles.field}>
          <span className={styles.label}>{dict.settingsName}</span>
          <input className={styles.input} name="name" defaultValue={values.name} required />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{dict.settingsVenue}</span>
          <input className={styles.input} name="venue" defaultValue={values.venue} />
        </label>
        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={styles.label}>{dict.settingsStart}</span>
            <input className={styles.input} type="date" name="startDate" defaultValue={values.startDate} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{dict.settingsEnd}</span>
            <input className={styles.input} type="date" name="endDate" defaultValue={values.endDate} />
          </label>
        </div>
      </Section>

      <Section title={dict.settingsSectionEntries} hint={dict.settingsEntriesHint}>
        <label className={styles.check}>
          <input type="checkbox" name="entriesOpen" defaultChecked={values.entriesOpen} />
          <span>{dict.settingsEntriesOpen}</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="requireCaptcha" defaultChecked={values.requireCaptcha} />
          <span>{dict.settingsCaptcha}</span>
        </label>
        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={styles.label}>{dict.settingsFee}</span>
            <input
              className={styles.input}
              name="entryFee"
              inputMode="decimal"
              defaultValue={values.entryFee}
              placeholder="0"
            />
            <span className={styles.hint}>{dict.settingsFeeHint}</span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{dict.settingsCurrency}</span>
            <input className={styles.input} name="currency" defaultValue={values.currency} />
          </label>
        </div>
      </Section>

      <Section title={dict.settingsSectionDraws}>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="consolationDraws"
            defaultChecked={values.consolationDraws}
            disabled={!values.consolationEditable}
          />
          <span>{dict.settingsConsolation}</span>
        </label>
        {!values.consolationEditable && (
          /* Honest rather than silently ignored: the flag is read at
             generation, so flipping it after a bracket exists does nothing
             to that bracket. */
          <p className={styles.hint}>{dict.settingsConsolationLocked}</p>
        )}
      </Section>

      <Section title={dict.settingsSectionDay} hint={dict.settingsDayHint}>
        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={styles.label}>{dict.settingsCourts}</span>
            <input className={styles.input} type="number" min="1" name="courtCount" defaultValue={values.courtCount} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{dict.settingsMatchMinutes}</span>
            <input className={styles.input} type="number" min="1" name="matchMinutes" defaultValue={values.matchMinutes} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{dict.settingsRestMinutes}</span>
            <input className={styles.input} type="number" min="0" name="minRestMinutes" defaultValue={values.minRestMinutes} />
          </label>
        </div>
      </Section>

      <div className={styles.footer}>
        <button className={styles.save} type="submit" disabled={pending}>
          {pending ? dict.saving : dict.save}
        </button>
        {state.error !== undefined && <p className={styles.error} role="alert">{state.error}</p>}
        {state.ok !== undefined && <p className={styles.saved} role="status">{dict.settingsSaved}</p>}
      </div>
    </form>
  );
}
