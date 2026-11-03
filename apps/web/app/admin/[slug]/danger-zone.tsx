import { deleteTournament } from '../tournament-actions';
import styles from './manage.module.css';

export function DangerZone({ slug, name }: { readonly slug: string; readonly name: string }) {
  return (
    <section className={styles.danger}>
      <h2 className={styles.blockTitle}>Delete</h2>
      <p className={styles.hint}>
        Deletes the tournament, every draw, every entrant, and every result.
        This cannot be undone.
      </p>
      <form action={deleteTournament} className={styles.dangerForm}>
        <input type="hidden" name="slug" value={slug} />
        <input
          className={styles.input}
          name="confirmName"
          placeholder={name}
          aria-label={`Type "${name}" to confirm`}
          autoComplete="off"
          required
        />
        {/* Retyping the name is the confirmation. A modal that needs only a
            click gets dismissed on reflex. */}
        <button className={styles.dangerButton} type="submit">
          Delete tournament
        </button>
      </form>
    </section>
  );
}
