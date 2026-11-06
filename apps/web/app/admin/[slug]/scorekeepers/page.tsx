/**
 * INF-3 — scorekeeper links.
 *
 * A volunteer gets a URL, not an account. No password for the club to issue,
 * reset or forget, and revoking access is one button rather than a
 * conversation.
 *
 * The link is scoped to this tournament and shown exactly once. Everything
 * after that is the list: who holds a link, whether it has ever been used,
 * and whether it still works.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageHeader, PageBody } from '@/components/page-header';
import { ScorekeeperList, type TokenRow } from './scorekeeper-list';
import adminStyles from '../../admin.module.css';
import styles from './scorekeepers.module.css';

export const metadata: Metadata = { title: 'Scorekeepers · Admin' };
export const dynamic = 'force-dynamic';

export default async function ScorekeepersPage({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser(`/admin/${slug}/scorekeepers`);
  const organizationId = orgId();

  const [tournament] = await db()
    .select({ id: schema.tournaments.id, name: schema.tournaments.name })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)))
    .limit(1);
  if (tournament === undefined) notFound();

  /*
   * The link is built from the REQUEST host, the same rule the QR codes
   * follow: a link generated on localhost and sent to a volunteer points at
   * the volunteer's own phone and silently fails.
   */
  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${proto}://${host}`;

  const rows = await db()
    .select({
      id: schema.scorekeeperTokens.id,
      label: schema.scorekeeperTokens.label,
      createdAt: schema.scorekeeperTokens.createdAt,
      lastUsedAt: schema.scorekeeperTokens.lastUsedAt,
      revokedAt: schema.scorekeeperTokens.revokedAt,
    })
    .from(schema.scorekeeperTokens)
    .where(eq(schema.scorekeeperTokens.tournamentId, tournament.id))
    .orderBy(asc(schema.scorekeeperTokens.createdAt));

  const when = (value: Date | null): string | null =>
    value === null
      ? null
      : new Intl.DateTimeFormat('en', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }).format(value);

  const tokens: TokenRow[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    created: when(r.createdAt) ?? '',
    lastUsed: when(r.lastUsedAt),
    revoked: r.revokedAt !== null,
  }));

  const active = tokens.filter((t) => !t.revoked).length;

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title="Scorekeepers"
        lead="Give a volunteer a link and they can enter scores for this tournament from their phone. No account, no password, and you can revoke it when the weekend is over."
        facts={[{ value: active, label: active === 1 ? 'active link' : 'active links' }]}
      />

      <PageBody>
        <ScorekeeperList slug={slug} baseUrl={baseUrl} tokens={tokens} />

        <p className={styles.note}>
          A link lets its holder record, clear and undo results for this tournament only.
          It cannot change draws, entrants or anything else.
        </p>
      </PageBody>
    </main>
  );
}
