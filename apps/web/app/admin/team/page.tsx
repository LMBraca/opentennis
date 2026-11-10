import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { can, listPendingInvitations, schema } from '@opentennis/db';
import { AdminActions } from '@/components/admin-actions';
import { AdminNav } from '@/components/admin-nav';
import { PageBody, PageHeader } from '@/components/page-header';
import { requireCapability } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { dictionary, intlLocale } from '@/lib/i18n/dictionaries';
import { currentLocale } from '@/lib/i18n/server';
import { InviteForm, PendingInviteRows } from './team-controls';
import adminStyles from '../admin.module.css';
import styles from './team.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: `${dict.adminTeam} · ${dict.adminEyebrow} · OpenTennis` };
}

export default async function TeamPage() {
  const user = await requireCapability('admins:invite', '/admin/team');
  const organizationId = orgId();
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const [actorMembership] = await db()
    .select({ role: schema.memberships.role })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.organizationId, organizationId),
        eq(schema.memberships.userId, user.id),
      ),
    )
    .limit(1);
  if (actorMembership === undefined || !can(actorMembership.role, 'admins:invite')) {
    redirect('/admin?denied=admins%3Ainvite');
  }
  const organizers = await db()
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(
      and(
        eq(schema.memberships.organizationId, organizationId),
        inArray(schema.memberships.role, ['owner', 'admin']),
      ),
    )
    .orderBy(asc(schema.memberships.createdAt));
  const pending = await listPendingInvitations(db(), organizationId, user.id);
  const dateFormatter = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
  const pendingRows = pending.map((invite) => ({
    id: invite.id,
    email: invite.email,
    expires: dateFormatter.format(invite.expiresAt),
  }));

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        nav={
          <AdminNav
            dict={dict}
            canManageContent={can(actorMembership.role, 'content:manage')}
            canMergePlayers={can(actorMembership.role, 'players:merge')}
            canInviteAdmins={can(actorMembership.role, 'admins:invite')}
          />
        }
        actions={<AdminActions dict={dict} email={user.email} />}
        title={dict.adminTeam}
        lead={dict.adminTeamLead}
      />
      <PageBody>
        <section className={styles.section} aria-labelledby="team-invite-heading">
          <h2 className={styles.heading} id="team-invite-heading">
            {dict.inviteAdmin}
          </h2>
          <InviteForm dict={dict} />
        </section>
        <section className={styles.section} aria-labelledby="team-organizers-heading">
          <h2 className={styles.heading} id="team-organizers-heading">
            {dict.currentOrganizers}
          </h2>
          <ul className={styles.list}>
            {organizers.map((organizer) => (
              <li key={organizer.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span>
                    {dict.memberName}: {organizer.name ?? '—'}
                  </span>
                  <span className={styles.muted}>
                    {dict.email}: {organizer.email}
                  </span>
                </div>
                <span className={styles.muted}>
                  {dict.memberRole}: {organizer.role === 'owner' ? dict.roleOwner : dict.roleAdmin}
                </span>
              </li>
            ))}
          </ul>
        </section>
        {pendingRows.length > 0 && (
          <section className={styles.section} aria-labelledby="team-pending-heading">
            <h2 className={styles.heading} id="team-pending-heading">
              {dict.pendingInvites}
            </h2>
            <PendingInviteRows invitations={pendingRows} dict={dict} />
          </section>
        )}
      </PageBody>
    </main>
  );
}
