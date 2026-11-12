import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './setup-steps.module.css';

/**
 * RV-17 — the setup path, shown as a path.
 *
 * The complaint was nine buttons in a row at the foot of the tournament
 * page, most of which are things you set once before the event and never
 * touch again. They are a sequence, not a menu, and a row of equal buttons
 * says nothing about which to press first.
 *
 * The wizard is a guided walk over a DRAFT tournament rather than a
 * separate flow with its own state. `createTournament` already makes a
 * draft and nothing is public until an organizer says so, so each step is
 * an ordinary edit of a real row. Three things fall out of that: a
 * half-finished setup survives a closed laptop, every step is reachable
 * again afterwards for an edit, and there is no wizard state to lose.
 *
 * Steps are ordered by dependency, not preference. Draws need categories
 * chosen; the scheduler needs courts; entries should not open before there
 * is something to enter.
 */

export type SetupStepKey = 'draws' | 'courts' | 'entries';

export const SETUP_STEPS: readonly SetupStepKey[] = ['draws', 'courts', 'entries'];

/**
 * Two of the three steps ARE existing screens, reached with `?setup=1` so
 * they know to show the path. Only the draws step needed a page of its own,
 * and even that renders the tournament page's own grid.
 *
 * The alternative — three purpose-built wizard screens — means two copies
 * of the court form and two copies of the entry controls, which drift. This
 * repo has paid for that mistake twice already.
 */
export function setupStepHref(slug: string, step: SetupStepKey): string {
  if (step === 'draws') return `/admin/${slug}/setup/draws`;
  if (step === 'courts') return `/admin/${slug}/schedule?setup=1`;
  return `/admin/${slug}/entries?setup=1`;
}

export function setupStepLabel(step: SetupStepKey, dict: Dictionary): string {
  if (step === 'draws') return dict.setupDraws;
  if (step === 'courts') return dict.setupCourts;
  return dict.setupEntries;
}

export function SetupSteps({
  slug,
  active,
  dict,
}: {
  readonly slug: string;
  readonly active: SetupStepKey;
  readonly dict: Dictionary;
}) {
  const activeIndex = SETUP_STEPS.indexOf(active);

  return (
    <nav className={styles.steps} aria-label={dict.setupTitle}>
      <ol className={styles.list}>
        {SETUP_STEPS.map((step, i) => {
          /*
           * "Done" means "behind you", not "valid". Nothing here is
           * mandatory — a club can run a tournament with one court and no
           * online entries — so a tick that claimed completeness would be
           * lying about steps the organizer deliberately skipped.
           */
          const state = i === activeIndex ? 'current' : i < activeIndex ? 'past' : 'ahead';
          return (
            <li key={step} className={styles.step} data-state={state}>
              <Link href={setupStepHref(slug, step)} className={styles.link}>
                <span className={styles.index} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.label}>{setupStepLabel(step, dict)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The control that moves you on. Separate from the stepper because the
 * last step's is a different destination and a different word.
 */
export function SetupNext({
  slug,
  active,
  dict,
}: {
  readonly slug: string;
  readonly active: SetupStepKey;
  readonly dict: Dictionary;
}) {
  const i = SETUP_STEPS.indexOf(active);
  const next = SETUP_STEPS[i + 1];
  const href = next === undefined ? `/admin/${slug}` : setupStepHref(slug, next);
  const label = next === undefined ? dict.setupFinish : dict.setupNext;

  return (
    <div className={styles.footer}>
      <Link href={href} className={styles.next}>
        {label}
      </Link>
    </div>
  );
}
