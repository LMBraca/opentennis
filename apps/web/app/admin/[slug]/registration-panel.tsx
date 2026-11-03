import { headers } from 'next/headers';
import { setEntriesOpen } from '../tournament-actions';
import { CopyLink } from './copy-link';
import styles from './manage.module.css';

/**
 * The registration link, and the switch that opens it.
 *
 * This is the main way entrants arrive, so the link is the most prominent
 * thing on the panel.
 *
 * An earlier version displayed the bare PATH ("/t/slug/enter"). That is not
 * a link — it cannot be pasted into a message, a poster, or a browser. The
 * absolute URL is built from the request host so what an organizer sees is
 * exactly what they can send, and the URL itself is the clickable element
 * rather than a separate arrow beside it.
 */
export async function RegistrationPanel({
  slug,
  entriesOpen,
}: {
  readonly slug: string;
  readonly entriesOpen: boolean;
}) {
  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  // Local development is the one place this is not https.
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/t/${slug}/enter`;

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
          : 'Entries are closed. The link still works and says so, which is why a printed poster never dead-ends.'}
      </p>

      <CopyLink url={url} open={entriesOpen} />
    </section>
  );
}
