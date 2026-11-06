import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@opentennis/db';
import { listTournamentsForAdmin } from '@/lib/queries';
import { logoutAction } from './actions';
import { PageHeader, PageBody } from '@/components/page-header';
import styles from './admin.module.css';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

/** Human wording for a capability, for the denial banner. */
const DENIAL: Record<string, string> = {
  destructive: 'delete a tournament',
  'tournaments:manage': 'create or change tournaments',
  'draws:manage': 'manage draws',
  'entrants:write': 'change entrants',
  'scores:write': 'record scores',
  'content:manage': 'edit club content',
  'scorekeepers:manage': 'manage scorekeeper links',
  'players:merge': 'merge players',
};

export default async function AdminHome({
  searchParams,
}: {
  readonly searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser('/admin');
  // Drafts included: this is the only page that can publish them.
  const tournaments = await listTournamentsForAdmin();
  const { denied } = await searchParams;

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        title="Tournaments"
        lead={`Signed in as ${user.email}`}
        actions={
          <form action={logoutAction}>
            <button className={styles.signOut} type="submit">Sign out</button>
          </form>
        }
      />

      <PageBody>
        {/* INF-2. A guard that silently bounces somebody leaves them
            thinking the site is broken; this says which power they lack
            and who they are. */}
        {denied !== undefined && (
          <p className={styles.denied} role="status">
            Your account ({user.role}) cannot {DENIAL[denied] ?? denied}. Ask the club owner
            if you need to.
          </p>
        )}

        <div className={styles.heroActions}>
          {can(user.role, 'tournaments:manage') && (
            <Link href="/admin/new" className={styles.newButton}>New tournament</Link>
          )}
          {can(user.role, 'content:manage') && (
            <Link href="/admin/updates" className={styles.secondaryButton}>Updates &amp; media</Link>
          )}
          {can(user.role, 'players:merge') && (
            <Link href="/admin/players" className={styles.secondaryButton}>Players</Link>
          )}
          {can(user.role, 'content:manage') && (
            <Link href="/admin/categories" className={styles.secondaryButton}>Categories</Link>
          )}
        </div>

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
                      <span>{t.drawCount} draws</span>
                      <span>{t.entrantCount} entrants</span>
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <Link className={styles.action} href={`/admin/${t.slug}`}>
                      Manage
                    </Link>
                    <Link className={styles.actionGhost} href={`/admin/${t.slug}/schedule`}>
                      Schedule
                    </Link>
                    {/* Only once it is actually public. A draft 404s on the
                        public site by design, so offering the link here just
                        hands the organizer a dead end. */}
                    {t.visibility !== 'draft' && (
                      <Link className={styles.actionGhost} href={`/t/${t.slug}`}>
                        View public
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </main>
  );
}
