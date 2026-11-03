import { setTournamentStatus } from '../tournament-actions';
import styles from './manage.module.css';

/**
 * Status and visibility are separate controls on purpose: a tournament can be
 * in progress but unlisted (a club running a private event), or published but
 * not yet started.
 */
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'inProgress', label: 'In progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const VISIBILITIES = [
  { value: 'draft', label: 'Hidden' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'public', label: 'Public' },
] as const;

export function StatusBar({
  slug,
  status,
  visibility,
}: {
  readonly slug: string;
  readonly status: string;
  readonly visibility: string;
}) {
  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>Status</h2>
      <div className={styles.statusRows}>
        <form action={setTournamentStatus} className={styles.statusRow}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="visibility" value={visibility} />
          <span className={styles.statusLabel}>Stage</span>
          <div className={styles.pills}>
            {STATUSES.map((s) => (
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
          <span className={styles.statusLabel}>Visibility</span>
          <div className={styles.pills}>
            {VISIBILITIES.map((v) => (
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
          ? 'Hidden: nobody can see this tournament or its draws.'
          : visibility === 'unlisted'
            ? 'Unlisted: reachable by link, but not listed on the home page.'
            : 'Public: listed on the home page.'}
      </p>
    </section>
  );
}
