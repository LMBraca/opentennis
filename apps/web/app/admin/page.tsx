import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listTournamentsForAdmin } from '@/lib/queries';
import { logoutAction } from './actions';
import styles from './admin.module.css';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const user = await requireUser('/admin');
  // Drafts included: this is the only page that can publish them.
  const tournaments = await listTournamentsForAdmin();

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <p className={styles.club}>Open Tennis · Admin</p>
            <form action={logoutAction}>
              <button className={styles.signOut} type="submit">
                Sign out
              </button>
            </form>
          </div>
          <h1 className={styles.title}>Tournaments</h1>
          <p className={styles.who}>Signed in as {user.email}</p>
          <div className={styles.heroActions}>
            <Link href="/admin/new" className={styles.newButton}>+ New tournament</Link>
            <Link href="/admin/updates" className={styles.secondaryButton}>Updates &amp; media</Link>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {tournaments.length === 0 ? (
          <p className={styles.empty}>No tournaments yet.</p>
        ) : (
          <ul className={styles.list}>
            {tournaments.map((t) => (
              <li key={t.id}>
                <div className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowName}>{t.name}</span>
                    <span className={styles.rowMeta}>
                      {t.visibility === 'draft' && (
                        <span className={styles.draftTag}>Draft</span>
                      )}
                      {t.drawCount} draws · {t.entrantCount} entrants
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <Link className={styles.action} href={`/admin/${t.slug}`}>
                      Manage
                    </Link>
                    <Link className={styles.actionGhost} href={`/admin/${t.slug}/schedule`}>
                      Schedule
                    </Link>
                    <Link className={styles.actionGhost} href={`/t/${t.slug}`}>
                      View public
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
