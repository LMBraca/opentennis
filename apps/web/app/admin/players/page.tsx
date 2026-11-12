/**
 * ADM-14 — the player directory.
 *
 * One list of every human the club knows about, across every tournament,
 * because that is the only place a duplicate is visible. Inside a single
 * tournament "Ana Hernández" and "Ana Hernandez" are two entrants in two
 * different draws and nothing looks wrong.
 *
 * Sorted by accent-folded SURNAME, the same ordering the entry queue uses,
 * so the two spellings sit next to each other. The likely-duplicate marking
 * is deliberately narrow — identical folded name, or identical email — and
 * everything else is left to a human reading adjacent rows.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { asc, eq, inArray } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import { can } from '@opentennis/db';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { duplicateGroups, matchesQuery, nameSortKey } from '@/lib/player-name';
import { PageHeader, PageBody } from '@/components/page-header';
import { AdminNav } from '@/components/admin-nav';
import { AdminActions } from '@/components/admin-actions';
import { PlayerDirectory, type DirectoryPlayer } from './player-directory';
import adminStyles from '../admin.module.css';
import styles from './players.module.css';

export const metadata: Metadata = { title: 'Players · Admin' };
export const dynamic = 'force-dynamic';

export default async function PlayersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireCapability('players:merge', '/admin/players');
  const dict = dictionary(await currentLocale());
  const organizationId = orgId();
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const people = await db()
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      email: schema.players.email,
      phone: schema.players.phone,
    })
    .from(schema.players)
    .where(eq(schema.players.organizationId, organizationId))
    .orderBy(asc(schema.players.lastName), asc(schema.players.firstName));

  /*
   * Entries per player in ONE query rather than per row. A club with three
   * hundred members and a dozen tournaments would otherwise issue three
   * hundred queries to render a list.
   */
  const entryRows =
    people.length === 0
      ? []
      : await db()
          .select({
            playerId: schema.entrantPlayers.playerId,
            tournamentName: schema.tournaments.name,
            tournamentSlug: schema.tournaments.slug,
            categoryCode: schema.categories.code,
            discipline: schema.events.discipline,
          })
          .from(schema.entrantPlayers)
          .innerJoin(schema.entrants, eq(schema.entrants.id, schema.entrantPlayers.entrantId))
          .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
          .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
          .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
          .where(
            inArray(
              schema.entrantPlayers.playerId,
              people.map((p) => p.id),
            ),
          );

  const entriesByPlayer = new Map<string, string[]>();
  for (const row of entryRows) {
    const label = `${row.tournamentName} — ${row.categoryCode} ${row.discipline}`;
    const bucket = entriesByPlayer.get(row.playerId);
    if (bucket === undefined) entriesByPlayer.set(row.playerId, [label]);
    else bucket.push(label);
  }

  // Duplicates are computed over EVERYONE, not just the filtered view, so a
  // search for one spelling still tells you the other exists.
  const groups = duplicateGroups(people);
  const duplicateOf = new Map<string, number>();
  groups.forEach((group, index) => {
    for (const id of group) duplicateOf.set(id, index);
  });

  const visible = people.filter((p) => matchesQuery(p, query));
  const sorted = [...visible].sort((a, b) =>
    nameSortKey(a.lastName, a.firstName).localeCompare(nameSortKey(b.lastName, b.firstName), 'es'),
  );

  const players: DirectoryPlayer[] = sorted.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    entries: entriesByPlayer.get(p.id) ?? [],
    duplicateGroup: duplicateOf.get(p.id) ?? null,
  }));

  const merges = await db()
    .select({
      id: schema.playerMerges.id,
      canonicalPlayerId: schema.playerMerges.canonicalPlayerId,
      mergedSnapshot: schema.playerMerges.mergedSnapshot,
      revertedAt: schema.playerMerges.revertedAt,
      createdAt: schema.playerMerges.createdAt,
    })
    .from(schema.playerMerges)
    .where(eq(schema.playerMerges.organizationId, organizationId))
    .orderBy(asc(schema.playerMerges.createdAt));

  const nameById = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const history = merges
    .slice()
    .reverse()
    .map((m) => {
      const snap = m.mergedSnapshot as { firstName?: string; lastName?: string };
      return {
        id: m.id,
        mergedName: `${snap.firstName ?? '?'} ${snap.lastName ?? ''}`.trim(),
        canonicalName: nameById.get(m.canonicalPlayerId) ?? 'a deleted player',
        reverted: m.revertedAt !== null,
        when: new Intl.DateTimeFormat('en', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }).format(m.createdAt),
      };
    });

  const flagged = groups.reduce((n, g) => n + g.length, 0);

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        actions={<AdminActions dict={dict} email={user.email} />}
        nav={
          <AdminNav
            dict={dict}
            canManageContent={can(user.role, 'content:manage')}
            canMergePlayers={can(user.role, 'players:merge')}
            canInviteAdmins={can(user.role, 'admins:invite')}
          />
        }
        title={dict.players}
        lead="Everyone the club has on record, across every tournament. The same person entered twice can be joined up here."
        facts={[
          { value: people.length, label: people.length === 1 ? 'player' : 'players' },
          ...(flagged > 0 ? [{ value: flagged, label: 'look alike', emphasis: true }] : []),
        ]}
      />

      <PageBody>
        <form className={styles.search} method="get">
          <input
            className={styles.searchInput}
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name or email"
            aria-label="Search players"
          />
          <button className={styles.searchButton} type="submit">
            Search
          </button>
          {query !== '' && (
            <Link className={styles.clear} href="/admin/players">
              Clear
            </Link>
          )}
        </form>

        {people.length === 0 ? (
          <p className={styles.empty}>
            No players yet. They are created when someone enters a tournament.
          </p>
        ) : players.length === 0 ? (
          <p className={styles.empty}>Nobody matches “{query}”.</p>
        ) : (
          <PlayerDirectory players={players} history={history} />
        )}
      </PageBody>
    </main>
  );
}
