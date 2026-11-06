'use client';

/**
 * The rail, and the one thing to do next.
 *
 * Replaces two status dropdowns, a registration panel and a hint that
 * contradicted it. The rail says where you are; the card says what to do.
 * Everything that belongs to another phase is either absent or folded away.
 */

import { useActionState } from 'react';
import { advancePhase, type ActionState } from '../tournament-actions';
import { CopyLink } from './copy-link';
import styles from './manage.module.css';

export interface PhasePanelProps {
  readonly slug: string;
  readonly phase: string;
  readonly label: string;
  readonly next: string | null;
  readonly detail: string | null;
  readonly steps: readonly { readonly key: string; readonly label: string; readonly done: boolean }[];
  /** Shown while entries are open — the thing the organizer actually sends. */
  readonly entryUrl: string | null;
  readonly entrantCount: number;
  readonly canAct: boolean;
}

export function PhasePanel({
  slug,
  phase,
  next,
  detail,
  steps,
  entryUrl,
  entrantCount,
  canAct,
}: PhasePanelProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(advancePhase, {});

  return (
    <section className={styles.phase}>
      <ol className={styles.rail} aria-label="Tournament progress">
        {steps.map((step) => (
          <li
            key={step.key}
            className={styles.railStep}
            data-state={step.key === phase ? 'current' : step.done ? 'done' : 'todo'}
            aria-current={step.key === phase ? 'step' : undefined}
          >
            {step.label}
          </li>
        ))}
      </ol>

      <div className={styles.nextCard}>
        {next === null ? (
          <p className={styles.nextDetail}>{detail}</p>
        ) : (
          <>
            <h2 className={styles.nextTitle}>{next}</h2>
            {detail !== null && <p className={styles.nextDetail}>{detail}</p>}
            {canAct && phase !== 'setup-empty' && (
              <form action={action}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="phase" value={phase} />
                <button className={styles.nextButton} type="submit" disabled={pending}>
                  {pending ? 'Working…' : next}
                </button>
              </form>
            )}
          </>
        )}

        {/* The link belongs with the phase that uses it, not in a panel of
            its own that stays on screen for the rest of the tournament. */}
        {entryUrl !== null && (
          <div className={styles.share}>
            <span className={styles.shareLabel}>
              {entrantCount} {entrantCount === 1 ? 'entrant' : 'entrants'} so far. Share this:
            </span>
            <CopyLink url={entryUrl} open />
          </div>
        )}

        {state.error !== undefined && <p className={styles.phaseError}>{state.error}</p>}
        {state.ok !== undefined && state.ok !== 'Done.' && (
          <p className={styles.phaseOk}>{state.ok}</p>
        )}
      </div>
    </section>
  );
}
