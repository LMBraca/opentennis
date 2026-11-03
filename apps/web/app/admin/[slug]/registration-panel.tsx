import { setEntriesOpen } from '../tournament-actions';
import styles from './manage.module.css';

/**
 * The registration link, and the switch that opens it.
 *
 * This is the main way entrants arrive, so the link is the most prominent
 * thing on the panel rather than buried in a settings page. Admin-typed
 * entrants remain possible for the person who turns up on the day.
 */
export function RegistrationPanel({
  slug,
  entriesOpen,
}: {
  readonly slug: string;
  readonly entriesOpen: boolean;
}) {
  const path = `/t/${slug}/enter`;

  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>Registration</h2>
        <form action={setEntriesOpen}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="open" value={String(!entriesOpen)} />
          <button className={entriesOpen ? styles.ghost : styles.submit} type="submit">
            {entriesOpen ? 'Close entries' : 'Open entries'}
          </button>
        </form>
      </div>

      <p className={styles.hint}>
        {entriesOpen
          ? 'Entries are open. Share this link — players enter themselves and appear below straight away.'
          : 'Entries are closed. The link still works and explains that, so a printed poster never dead-ends.'}
      </p>

      <div className={styles.linkBox} data-open={entriesOpen}>
        <code className={styles.linkCode}>{path}</code>
        <a className={styles.linkOpen} href={path} target="_blank" rel="noreferrer">
          Open →
        </a>
      </div>
    </section>
  );
}
