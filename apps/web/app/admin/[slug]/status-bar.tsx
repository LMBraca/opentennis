import { setTournamentStatus } from '../tournament-actions';
import { ConfirmAction } from '@/components/confirm-action';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './manage.module.css';

/**
 * Status and visibility are separate controls on purpose: a tournament can be
 * in progress but unlisted (a club running a private event), or published but
 * not yet started.
 */
export function StatusBar({
  slug,
  status,
  visibility,
  dict,
}: {
  readonly slug: string;
  readonly status: string;
  readonly visibility: string;
  readonly dict: Dictionary;
}) {
  const statuses = [
    { value: 'draft', label: dict.statusDraft },
    { value: 'published', label: dict.statusPublished },
    { value: 'inProgress', label: dict.statusInProgress },
    { value: 'complete', label: dict.statusComplete },
    { value: 'cancelled', label: dict.statusCancelled },
  ] as const;
  const visibilities = [
    { value: 'draft', label: dict.hidden },
    { value: 'unlisted', label: dict.unlisted },
    { value: 'public', label: dict.publicLabel },
  ] as const;

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>{dict.status}</h2>
      <div className={styles.statusRows}>
        <form action={setTournamentStatus} className={styles.statusRow}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="visibility" value={visibility} />
          <span className={styles.statusLabel}>{dict.stage}</span>
          <div className={styles.pills}>
            {statuses.map((s) => (
              <button
                key={s.value}
                className={styles.pill}
                data-active={s.value === status}
                name="status"
                value={s.value}
                type="submit"
              >
                {s.label}
              </button>
            ))}
          </div>
        </form>

        {/*
          OT-19. One form PER OPTION, not one form with three submits.

          Hiding a tournament that is currently public takes its pages off
          the internet, and the club's QR codes are printed on paper that
          does not know that — so that one transition asks first, and
          `ConfirmAction` brings its own form. A form cannot nest inside
          another, so the row had to stop being a single form. The others
          submit on one click as before: making a tournament MORE visible
          is not the move anyone regrets.
        */}
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>{dict.visibility}</span>
          <div className={styles.pills}>
            {visibilities.map((v) => {
              const hiding = v.value === 'draft' && visibility !== 'draft';
              const fields = (
                <>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="status" value={status} />
                  <input type="hidden" name="visibility" value={v.value} />
                </>
              );
              return hiding ? (
                <ConfirmAction
                  key={v.value}
                  action={setTournamentStatus}
                  label={v.label}
                  confirmLabel={v.label}
                  consequence={dict.hideTournamentConsequence}
                  cancelLabel={dict.cancel}
                  danger
                  className={styles.pill}
                >
                  {fields}
                </ConfirmAction>
              ) : (
                <form key={v.value} action={setTournamentStatus}>
                  {fields}
                  <button
                    className={styles.pill}
                    data-active={v.value === visibility}
                    type="submit"
                  >
                    {v.label}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      </div>
      <p className={styles.hint}>
        {visibility === 'draft'
          ? dict.visibilityHiddenHint
          : visibility === 'unlisted'
            ? dict.visibilityUnlistedHint
            : dict.visibilityPublicHint}
      </p>
    </section>
  );
}
