'use server';

/**
 * Tournament lifecycle mutations.
 *
 * Every action re-checks the session and scopes by organization. A server
 * action is a public HTTP endpoint with a generated name, not a private
 * function call — treating it as trusted because the UI that calls it sits
 * behind a guard is exactly how an admin API gets exposed.
 */

import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  clearDraw,
  loadEntrantsForEngine,
  nextAvailableSlug,
  persistDraw,
  schema,
  tournamentSlug,
} from '@opentennis/db';
import {
  generateRoundRobin,
  generateSingleElimination,
  type Entrant,
  type GeneratedStage,
} from '@opentennis/engine';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export interface ActionState {
  readonly error?: string;
  readonly ok?: string;
}

async function guard(): Promise<string> {
  await requireUser();
  return orgId();
}

async function tournamentBySlug(organizationId: string, slug: string) {
  const rows = await db()
    .select({ id: schema.tournaments.id, slug: schema.tournaments.slug })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);
  return rows[0];
}

/* ------------------------------------------------------------------------- */
/* Create                                                                    */
/* ------------------------------------------------------------------------- */

export async function createTournament(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = await guard();

  const name = String(formData.get('name') ?? '').trim();
  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();

  if (name === '') return { error: 'Give the tournament a name.' };
  if (startDate !== '' && endDate !== '' && endDate < startDate) {
    return { error: 'The end date cannot fall before the start date.' };
  }

  const taken = new Set(
    (await db().select({ slug: schema.tournaments.slug }).from(schema.tournaments)).map(
      (t) => t.slug,
    ),
  );
  const year = startDate === '' ? undefined : Number(startDate.slice(0, 4));
  const slug = nextAvailableSlug(tournamentSlug(name, year), (s) => taken.has(s));

  const [created] = await db()
    .insert(schema.tournaments)
    .values({
      organizationId,
      name,
      slug,
      // One club, so the venue is not a question worth asking.
      venue: 'Open Tennis',
      startDate: startDate === '' ? null : startDate,
      endDate: endDate === '' ? null : endDate,
      // A new tournament is a draft: nothing is public until an admin says so.
      status: 'draft',
      visibility: 'draft',
    })
    .returning({ slug: schema.tournaments.slug });

  if (created === undefined) return { error: 'Could not create the tournament.' };

  revalidatePath('/admin');
  redirect(`/admin/${created.slug}`);
}

/* ------------------------------------------------------------------------- */
/* Status and deletion                                                       */
/* ------------------------------------------------------------------------- */

export async function setTournamentStatus(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const status = String(formData.get('status') ?? '');
  const visibility = String(formData.get('visibility') ?? '');

  const allowedStatus = ['draft', 'published', 'inProgress', 'complete', 'cancelled'];
  const allowedVisibility = ['draft', 'unlisted', 'public'];
  if (!allowedStatus.includes(status) || !allowedVisibility.includes(visibility)) return;

  await db()
    .update(schema.tournaments)
    .set({
      status: status as 'draft',
      visibility: visibility as 'draft',
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    );

  revalidatePath(`/admin/${slug}`);
  revalidatePath('/', 'layout');
}

export async function deleteTournament(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  // Typing the name is the confirmation. A modal that only needs a click is
  // dismissed on reflex; retyping the name is not.
  const confirmation = String(formData.get('confirmName') ?? '').trim();

  const rows = await db()
    .select({ id: schema.tournaments.id, name: schema.tournaments.name })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);

  const tournament = rows[0];
  if (tournament === undefined || confirmation !== tournament.name) {
    redirect(`/admin/${slug}?error=name`);
  }

  await db().delete(schema.tournaments).where(eq(schema.tournaments.id, tournament.id));
  revalidatePath('/admin');
  redirect('/admin');
}

/* ------------------------------------------------------------------------- */
/* The category grid                                                         */
/* ------------------------------------------------------------------------- */

const FORMAT_VALUES = ['roundRobin', 'singleElimination'] as const;

/** Turn a grid cell on or off. Off deletes the event and everything under it. */
export async function toggleEvent(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const discipline = String(formData.get('discipline') ?? '');
  const format = String(formData.get('format') ?? 'singleElimination');

  if (discipline !== 'singles' && discipline !== 'doubles') return;
  if (!FORMAT_VALUES.includes(format as 'roundRobin')) return;

  const tournament = await tournamentBySlug(organizationId, slug);
  if (tournament === undefined) return;

  const existing = await db()
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.tournamentId, tournament.id),
        eq(schema.events.categoryId, categoryId),
        eq(schema.events.discipline, discipline),
      ),
    )
    .limit(1);

  if (existing[0] !== undefined) {
    await db().delete(schema.events).where(eq(schema.events.id, existing[0].id));
  } else {
    await db().insert(schema.events).values({
      organizationId,
      tournamentId: tournament.id,
      categoryId,
      discipline,
      format: format as 'roundRobin',
      status: 'draft',
    });
  }

  revalidatePath(`/admin/${slug}`);
}

export async function setEventFormat(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const format = String(formData.get('format') ?? '');
  if (!FORMAT_VALUES.includes(format as 'roundRobin')) return;

  await db()
    .update(schema.events)
    .set({ format: format as 'roundRobin', updatedAt: new Date() })
    .where(and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)));

  revalidatePath(`/admin/${slug}`);
}

/** Mark a cell as not held. The draw is cleared; entrants are kept. */
export async function setEventStatus(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!['draft', 'ready', 'published', 'inProgress', 'complete', 'notRun'].includes(status)) return;

  if (status === 'notRun') await clearDraw(db(), organizationId, eventId);

  await db()
    .update(schema.events)
    .set({ status: status as 'draft', updatedAt: new Date() })
    .where(and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)));

  revalidatePath(`/admin/${slug}`);
  revalidatePath('/', 'layout');
}

/* ------------------------------------------------------------------------- */
/* Entrants                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Paste a list of names, one per line.
 *
 * Doubles accept "Partner A / Partner B" on one line; a singles line is one
 * player. A trailing ", Club" is kept as the club affiliation. Anything that
 * cannot be parsed is reported rather than silently dropped — an organizer
 * who pastes 32 names and gets 31 entrants needs to know which one vanished.
 */
export async function addEntrants(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const raw = String(formData.get('names') ?? '');

  const events = await db()
    .select({ id: schema.events.id, discipline: schema.events.discipline })
    .from(schema.events)
    .where(and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)))
    .limit(1);
  const event = events[0];
  if (event === undefined) return { error: 'Event not found.' };

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
  if (lines.length === 0) return { error: 'Paste at least one name.' };

  const parsePerson = (text: string): { firstName: string; lastName: string; club: string | null } => {
    const [namePart, clubPart] = text.split(',').map((p) => p.trim());
    const words = (namePart ?? '').split(/\s+/).filter(Boolean);
    // One word is a surname, not a first name: a draw sheet shows surnames.
    const lastName = words.length === 1 ? (words[0] as string) : (words.at(-1) as string);
    const firstName = words.length === 1 ? '' : words.slice(0, -1).join(' ');
    return { firstName, lastName, club: clubPart === undefined || clubPart === '' ? null : clubPart };
  };

  let added = 0;
  const rejected: string[] = [];

  for (const line of lines) {
    const parts = line.split('/').map((p) => p.trim()).filter((p) => p !== '');
    const needed = event.discipline === 'doubles' ? 2 : 1;

    if (parts.length !== needed) {
      rejected.push(line);
      continue;
    }

    const [entrant] = await db()
      .insert(schema.entrants)
      .values({ organizationId, eventId, status: 'active' })
      .returning({ id: schema.entrants.id });
    if (entrant === undefined) continue;

    for (const [position, part] of parts.entries()) {
      const { firstName, lastName, club } = parsePerson(part);
      const [player] = await db()
        .insert(schema.players)
        .values({ organizationId, firstName, lastName, clubAffiliation: club })
        .returning({ id: schema.players.id });
      if (player === undefined) continue;
      await db()
        .insert(schema.entrantPlayers)
        .values({ entrantId: entrant.id, playerId: player.id, position });
    }
    added++;
  }

  revalidatePath(`/admin/${slug}`);

  if (rejected.length > 0) {
    const expected = event.discipline === 'doubles' ? '"Partner A / Partner B"' : 'one name per line';
    return {
      ok: `Added ${added}.`,
      error: `${rejected.length} line${rejected.length === 1 ? '' : 's'} skipped — expected ${expected}: ${rejected.slice(0, 3).join('; ')}`,
    };
  }
  return { ok: `Added ${added} ${added === 1 ? 'entrant' : 'entrants'}.` };
}

export async function clearEntrants(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');

  await clearDraw(db(), organizationId, eventId);
  await db()
    .delete(schema.entrants)
    .where(and(eq(schema.entrants.organizationId, organizationId), eq(schema.entrants.eventId, eventId)));
  await db()
    .update(schema.events)
    .set({ status: 'draft', updatedAt: new Date() })
    .where(eq(schema.events.id, eventId));

  revalidatePath(`/admin/${slug}`);
}

/** Open or close the public registration form. */
export async function setEntriesOpen(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const open = String(formData.get('open') ?? '') === 'true';

  await db()
    .update(schema.tournaments)
    .set({ entriesOpen: open, updatedAt: new Date() })
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    );

  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/t/${slug}/enter`);
}

/** The organizer's one job per entrant: has the fee been paid? */
export async function togglePaid(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const entrantId = String(formData.get('entrantId') ?? '');
  const paid = String(formData.get('paid') ?? '') === 'true';

  await db()
    .update(schema.entrants)
    .set({ paid, paidAt: paid ? new Date() : null, updatedAt: new Date() })
    .where(
      and(eq(schema.entrants.organizationId, organizationId), eq(schema.entrants.id, entrantId)),
    );

  revalidatePath(`/admin/${slug}`);
}

/** Remove one entrant. Used for a withdrawal or a duplicate. */
export async function removeEntrant(formData: FormData): Promise<void> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const entrantId = String(formData.get('entrantId') ?? '');

  await db()
    .delete(schema.entrants)
    .where(
      and(eq(schema.entrants.organizationId, organizationId), eq(schema.entrants.id, entrantId)),
    );

  revalidatePath(`/admin/${slug}`);
}

/** Entrants for one event, with their players and payment state. */
export async function listEntrants(eventId: string): Promise<
  Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    paid: boolean;
    selfRegistered: boolean;
  }>
> {
  const rows = await db()
    .select({
      id: schema.entrants.id,
      paid: schema.entrants.paid,
      email: schema.entrants.contactEmail,
      phone: schema.entrants.contactPhone,
      createdAt: schema.entrants.createdAt,
      position: schema.entrantPlayers.position,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
    })
    .from(schema.entrants)
    .leftJoin(schema.entrantPlayers, eq(schema.entrantPlayers.entrantId, schema.entrants.id))
    .leftJoin(schema.players, eq(schema.players.id, schema.entrantPlayers.playerId))
    .where(eq(schema.entrants.eventId, eventId))
    .orderBy(asc(schema.entrants.createdAt), asc(schema.entrantPlayers.position));

  const byEntrant = new Map<
    string,
    { id: string; names: string[]; email: string | null; phone: string | null; paid: boolean }
  >();
  for (const r of rows) {
    const entry = byEntrant.get(r.id) ?? {
      id: r.id,
      names: [],
      email: r.email,
      phone: r.phone,
      paid: r.paid,
    };
    const name = [r.firstName, r.lastName].filter((s) => s !== null && s !== '').join(' ');
    if (name !== '') entry.names.push(name);
    byEntrant.set(r.id, entry);
  }

  return [...byEntrant.values()].map((e) => ({
    id: e.id,
    name: e.names.join(' / '),
    email: e.email,
    phone: e.phone,
    paid: e.paid,
    // An admin-typed entrant has no contact details; a self-registered one does.
    selfRegistered: e.email !== null,
  }));
}

/* ------------------------------------------------------------------------- */
/* Draw generation                                                           */
/* ------------------------------------------------------------------------- */

export async function generateDraws(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = await guard();
  const slug = String(formData.get('slug') ?? '');
  const onlyEventId = String(formData.get('eventId') ?? '');

  const tournament = await tournamentBySlug(organizationId, slug);
  if (tournament === undefined) return { error: 'Tournament not found.' };

  const events = await db()
    .select({
      id: schema.events.id,
      format: schema.events.format,
      status: schema.events.status,
      code: schema.categories.code,
      discipline: schema.events.discipline,
      thirdPlacePlayoff: schema.events.thirdPlacePlayoff,
    })
    .from(schema.events)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(
      and(
        eq(schema.events.tournamentId, tournament.id),
        onlyEventId === '' ? inArray(schema.events.status, ['draft', 'ready', 'published']) : eq(schema.events.id, onlyEventId),
      ),
    )
    .orderBy(asc(schema.categories.rank));

  if (events.length === 0) return { error: 'No events to generate.' };

  const done: string[] = [];
  const skipped: string[] = [];

  for (const event of events) {
    const label = `${event.code} ${event.discipline}`;
    const entrants = await loadEntrantsForEngine(db(), organizationId, event.id);

    // Two is the minimum real draw. Below that there is nothing to generate,
    // and saying so beats an empty bracket an organizer has to interpret.
    if (entrants.length < 2) {
      skipped.push(`${label} (${entrants.length} entrants)`);
      continue;
    }

    await clearDraw(db(), organizationId, event.id);

    const engineEntrants: Entrant[] = entrants.map((e) => ({
      id: e.id,
      seed: e.seed,
      status: 'active',
    }));
    const randomSeed = `${slug}|${event.id}`;

    try {
      const stage: GeneratedStage =
        event.format === 'roundRobin'
          ? generateRoundRobin({ entrants: engineEntrants, randomSeed, groupName: 'Round robin' })
          : generateSingleElimination({
              entrants: engineEntrants,
              randomSeed,
              ...(event.thirdPlacePlayoff ? { thirdPlacePlayoff: true } : {}),
            });

      await persistDraw({
        db: db(),
        organizationId,
        tournamentId: tournament.id,
        eventId: event.id,
        stage,
        entrantIdMap: new Map(engineEntrants.map((e) => [e.id, e.id])),
      });
      done.push(label);
    } catch (error) {
      skipped.push(`${label} (${error instanceof Error ? error.message : 'failed'})`);
    }
  }

  revalidatePath(`/admin/${slug}`);
  revalidatePath('/', 'layout');

  if (done.length === 0) {
    return { error: `Nothing generated. ${skipped.join('; ')}` };
  }
  return {
    ok: `Generated ${done.length} ${done.length === 1 ? 'draw' : 'draws'}: ${done.join(', ')}.`,
    ...(skipped.length > 0 ? { error: `Skipped ${skipped.join('; ')}` } : {}),
  };
}

/**
 * Single-cell variant for a plain form, where there is no useActionState to
 * carry a result. Errors surface as the cell's state rather than a message.
 */
export async function generateDrawForEvent(formData: FormData): Promise<void> {
  await generateDraws({}, formData);
}

/** Counts for the admin grid, in one pass rather than per cell. */
export async function eventCounts(
  tournamentId: string,
): Promise<Map<string, { entrants: number; matches: number }>> {
  const entrantRows = await db()
    .select({ eventId: schema.entrants.eventId, n: count(schema.entrants.id) })
    .from(schema.entrants)
    .innerJoin(schema.events, eq(schema.events.id, schema.entrants.eventId))
    .where(and(eq(schema.events.tournamentId, tournamentId), eq(schema.entrants.status, 'active')))
    .groupBy(schema.entrants.eventId);

  const matchRows = await db()
    .select({ eventId: schema.matches.eventId, n: count(schema.matches.id) })
    .from(schema.matches)
    .where(eq(schema.matches.tournamentId, tournamentId))
    .groupBy(schema.matches.eventId);

  const out = new Map<string, { entrants: number; matches: number }>();
  for (const r of entrantRows) out.set(r.eventId, { entrants: r.n, matches: 0 });
  for (const r of matchRows) {
    out.set(r.eventId, { entrants: out.get(r.eventId)?.entrants ?? 0, matches: r.n });
  }
  return out;
}
