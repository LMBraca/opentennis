'use server';

/**
 * ADM-14 — merging duplicate players, reversibly.
 *
 * The same person enters the C+ singles in November and the C doubles in
 * December, types their name slightly differently, and becomes two people.
 * The entry queue already sorts near-identical surnames adjacent so an
 * organizer SEES it (ENT-8); this is the part that does something about it.
 *
 * Reversible by construction, which is why `playerMerges` stores a full
 * snapshot of the row that went away and the exact list of `entrant_players`
 * rows that moved. An undo that has to guess which entries used to belong to
 * whom is not an undo.
 *
 * Everything runs in ONE transaction. A merge that reassigned half an
 * entrant list and then failed would leave a player who cannot be deleted
 * (`entrant_players.playerId` is onDelete: restrict) and no merge row to
 * undo from — the worst of both states.
 */

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';

export interface MergeState {
  readonly ok?: string;
  readonly error?: string;
}

/** The merged player's row, kept verbatim so an undo can put it back. */
interface PlayerSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly clubAffiliation: string | null;
}

export async function mergePlayers(_prev: MergeState, form: FormData): Promise<MergeState> {
  const user = await requireCapability('players:merge', '/admin/players');
  const organizationId = orgId();

  const canonicalId = String(form.get('canonicalId') ?? '');
  const mergedIds = form
    .getAll('mergedId')
    .map((v) => String(v))
    .filter((v) => v !== '' && v !== canonicalId);

  if (canonicalId === '') return { error: 'Choose which player to keep.' };
  if (mergedIds.length === 0) return { error: 'Choose at least one other player to merge in.' };

  const people = await db()
    .select()
    .from(schema.players)
    .where(
      and(
        eq(schema.players.organizationId, organizationId),
        inArray(schema.players.id, [canonicalId, ...mergedIds]),
      ),
    );

  const canonical = people.find((p) => p.id === canonicalId);
  if (canonical === undefined) return { error: 'The player to keep no longer exists.' };
  const toMerge = people.filter((p) => p.id !== canonicalId);
  if (toMerge.length === 0) return { error: 'Those players no longer exist.' };

  let movedTotal = 0;
  const sameEventWarnings: string[] = [];

  await db().transaction(async (tx) => {
    for (const merged of toMerge) {
      const links = await tx
        .select({ id: schema.entrantPlayers.id, entrantId: schema.entrantPlayers.entrantId })
        .from(schema.entrantPlayers)
        .where(eq(schema.entrantPlayers.playerId, merged.id));

      /*
       * If BOTH players are already on the same entrant, moving the link
       * would collide with `entrant_players_unique`. That means a doubles
       * pair recorded as two names for one human, so the right answer is to
       * drop the duplicate link rather than fail the whole merge — but the
       * link row is recorded either way so the undo can rebuild it.
       */
      const canonicalEntrants = new Set(
        (
          await tx
            .select({ entrantId: schema.entrantPlayers.entrantId })
            .from(schema.entrantPlayers)
            .where(eq(schema.entrantPlayers.playerId, canonicalId))
        ).map((r) => r.entrantId),
      );

      const movable = links.filter((l) => !canonicalEntrants.has(l.entrantId));
      const colliding = links.filter((l) => canonicalEntrants.has(l.entrantId));

      if (movable.length > 0) {
        await tx
          .update(schema.entrantPlayers)
          .set({ playerId: canonicalId, updatedAt: new Date() })
          .where(
            inArray(
              schema.entrantPlayers.id,
              movable.map((l) => l.id),
            ),
          );
      }
      if (colliding.length > 0) {
        await tx.delete(schema.entrantPlayers).where(
          inArray(
            schema.entrantPlayers.id,
            colliding.map((l) => l.id),
          ),
        );
        sameEventWarnings.push(
          `${merged.firstName} ${merged.lastName} was on ${colliding.length} of the same ${
            colliding.length === 1 ? 'entry' : 'entries'
          } already`,
        );
      }
      movedTotal += movable.length;

      const snapshot: PlayerSnapshot = {
        id: merged.id,
        organizationId: merged.organizationId,
        firstName: merged.firstName,
        lastName: merged.lastName,
        email: merged.email,
        phone: merged.phone,
        clubAffiliation: merged.clubAffiliation,
      };

      await tx.insert(schema.playerMerges).values({
        organizationId,
        canonicalPlayerId: canonicalId,
        mergedPlayerId: merged.id,
        mergedSnapshot: snapshot,
        // Both lists, because an undo has to move the moved ones back AND
        // recreate the ones that were dropped as duplicates.
        reassignedEntrantIds: {
          moved: movable.map((l) => ({ id: l.id, entrantId: l.entrantId })),
          dropped: colliding.map((l) => ({ id: l.id, entrantId: l.entrantId })),
        },
        performedByUserId: user.id,
      });

      // Safe only now that nothing references it: the column is
      // onDelete: 'restrict' precisely so this ordering cannot be got wrong.
      await tx.delete(schema.players).where(eq(schema.players.id, merged.id));
    }
  });

  revalidatePath('/admin/players');
  revalidatePath('/', 'layout');

  const name = `${canonical.firstName} ${canonical.lastName}`;
  const note = sameEventWarnings.length > 0 ? ` (${sameEventWarnings.join('; ')})` : '';
  return {
    ok: `Merged ${toMerge.length} ${toMerge.length === 1 ? 'player' : 'players'} into ${name}. ${movedTotal} ${movedTotal === 1 ? 'entry' : 'entries'} moved${note}.`,
  };
}

/**
 * Put a merged player back.
 *
 * The snapshot is restored under its ORIGINAL id, so every entrant link that
 * pointed at it before can simply point at it again. Recreating the person
 * with a fresh id would orphan their history, which is the thing a reversible
 * merge exists to prevent.
 */
export async function undoMerge(_prev: MergeState, form: FormData): Promise<MergeState> {
  await requireCapability('players:merge', '/admin/players');
  const organizationId = orgId();
  const mergeId = String(form.get('mergeId') ?? '');
  if (mergeId === '') return { error: 'Missing merge.' };

  const rows = await db()
    .select()
    .from(schema.playerMerges)
    .where(
      and(
        eq(schema.playerMerges.organizationId, organizationId),
        eq(schema.playerMerges.id, mergeId),
        isNull(schema.playerMerges.revertedAt),
      ),
    )
    .limit(1);

  const merge = rows[0];
  if (merge === undefined) return { error: 'That merge has already been undone.' };

  const snapshot = merge.mergedSnapshot as PlayerSnapshot;
  const links = merge.reassignedEntrantIds as {
    moved?: ReadonlyArray<{ id: string; entrantId: string }>;
    dropped?: ReadonlyArray<{ id: string; entrantId: string }>;
  };

  await db().transaction(async (tx) => {
    await tx.insert(schema.players).values({
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      email: snapshot.email,
      phone: snapshot.phone,
      clubAffiliation: snapshot.clubAffiliation,
    });

    const moved = links.moved ?? [];
    if (moved.length > 0) {
      await tx
        .update(schema.entrantPlayers)
        .set({ playerId: snapshot.id, updatedAt: new Date() })
        .where(
          inArray(
            schema.entrantPlayers.id,
            moved.map((l) => l.id),
          ),
        );
    }

    // Links dropped as same-entrant duplicates are rebuilt with a fresh id;
    // their original row is gone and the unique constraint is on
    // (entrantId, playerId), which is satisfied again now the player is back.
    for (const link of links.dropped ?? []) {
      await tx.insert(schema.entrantPlayers).values({
        entrantId: link.entrantId,
        playerId: snapshot.id,
        position: 1,
      });
    }

    await tx
      .update(schema.playerMerges)
      .set({ revertedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.playerMerges.id, mergeId));
  });

  revalidatePath('/admin/players');
  revalidatePath('/', 'layout');
  return { ok: `${snapshot.firstName} ${snapshot.lastName} is a separate player again.` };
}
