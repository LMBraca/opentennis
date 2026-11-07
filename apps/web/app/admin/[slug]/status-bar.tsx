import { setTournamentStatus } from '../tournament-actions';
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

        <form action={setTournamentStatus} className={styles.statusRow}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="status" value={status} />
          <span className={styles.statusLabel}>{dict.visibility}</span>
          <div className={styles.pills}>
            {visibilities.map((v) => (
              <button
                key={v.value}
                className={styles.pill}
                data-active={v.value === visibility}
                name="visibility"
                value={v.value}
                type="submit"
              >
                {v.label}
              </button>
            ))}
          </div>
        </form>
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
