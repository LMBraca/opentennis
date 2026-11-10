import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@opentennis/db';
import { listTournamentsForAdmin } from '@/lib/queries';
import { PageHeader, PageBody } from '@/components/page-header';
import { AdminNav } from '@/components/admin-nav';
import { AdminActions } from '@/components/admin-actions';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';
import styles from './admin.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: dict.tournaments };
}

export default async function AdminHome({
  searchParams,
}: {
  readonly searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser('/admin');
  const dict = dictionary(await currentLocale());
  // Drafts included: this is the only page that can publish them.
  const tournaments = await listTournamentsForAdmin();
  const { denied } = await searchParams;

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        title={dict.tournaments}
        nav={
          <AdminNav
            dict={dict}
            canManageContent={can(user.role, 'content:manage')}
            canMergePlayers={can(user.role, 'players:merge')}
          />
        }
        lead={fill(dict.signedInAs, { email: user.email })}
        actions={<AdminActions dict={dict} />}
      />

      <PageBody>
        {/* INF-2. A guard that silently bounces somebody leaves them
            thinking the site is broken; this says which power they lack
            and who they are. */}
        {denied !== undefined && (
          <p className={styles.denied} role="status">
            {fill(dict.permissionDenied, {
              role: user.role,
              action:
                (
                  {
                    destructive: dict.denialDeleteTournament,
                    'tournaments:manage': dict.denialManageTournaments,
                    'draws:manage': dict.denialManageDraws,
                    'entrants:write': dict.denialChangeEntrants,
                    'scores:write': dict.denialRecordScores,
                    'content:manage': dict.denialManageContent,
                    'scorekeepers:manage': dict.denialManageScorekeepers,
                    'players:merge': dict.denialMergePlayers,
                  } satisfies Record<string, string>
                )[denied] ?? denied,
            })}{' '}
            {dict.askOwner}
          </p>
        )}

        {can(user.role, 'tournaments:manage') && (
          <Link href="/admin/new" className={styles.pageAction}>
            {dict.newTournament}
          </Link>
        )}

        {tournaments.length === 0 ? (
          <p className={styles.empty}>{dict.noTournamentsYet}</p>
        ) : (
          <ul className={styles.list}>
            {tournaments.map((t) => (
              <li key={t.id}>
                <div className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowName}>{t.name}</span>
                    <span className={styles.rowMeta}>
                      {t.visibility === 'draft' && (
                        <span className={styles.draftTag}>{dict.draftLabel}</span>
                      )}
                      <span>
                        {t.drawCount} {t.drawCount === 1 ? dict.draw : dict.draws}
                      </span>
                      <span>
                        {t.entrantCount} {t.entrantCount === 1 ? dict.entrant : dict.entrants}
                      </span>
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <Link className={styles.action} href={`/admin/${t.slug}`}>
                      {dict.manage}
                    </Link>
                    <Link className={styles.actionGhost} href={`/admin/${t.slug}/schedule`}>
                      {dict.schedule}
                    </Link>
                    {/* Only once it is actually public. A draft 404s on the
                        public site by design, so offering the link here just
                        hands the organizer a dead end. */}
                    {t.visibility !== 'draft' && (
                      <Link className={styles.actionGhost} href={`/t/${t.slug}`}>
                        {dict.viewPublic}
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
