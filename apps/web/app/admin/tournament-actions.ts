'use server';

/**
 * Tournament lifecycle mutations.
 *
 * Every action re-checks the session and scopes by organization. A server
 * action is a public HTTP endpoint with a generated name, not a private
 * function call — treating it as trusted because the UI that calls it sits
 * behind a guard is exactly how an admin API gets exposed.
 */

import { and, asc, count, eq, inArray, isNotNull, ne } from 'drizzle-orm';
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
  generateConsolation,
  generateRoundRobin,
  generateSingleElimination,
  SCORING_PRESETS,
  type Entrant,
  type GeneratedStage,
  type ScoringPresetName,
} from '@opentennis/engine';
import { db, orgId } from '@/lib/db';
import { guessMapping, parseCsv, type ImportField } from '@/lib/csv';
import { splitName } from '@/lib/accept-entry';
import { requireUser } from '@/lib/auth';
import { can, type Capability } from '@opentennis/db';

export interface ActionState {
  readonly error?: string;
  readonly ok?: string;
}

/**
 * INF-2: every admin action states the power it needs.
 *
 * Redirecting rather than returning an error, because a server action CAN
 * redirect (Next turns the thrown NEXT_REDIRECT into a client navigation)
 * and this keeps all eighteen call sites to one line. The UI hides what a
 * role cannot do; this is the backstop for anyone who posts the form
 * anyway, which is the only version that actually enforces anything.
 */
async function guard(capability: Capability = 'tournaments:manage'): Promise<string> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect(`/admin?denied=${encodeURIComponent(capability)}`);
  return orgId();
}

async function tournamentBySlug(organizationId: string, slug: string) {
  const rows = await db()
    .select({
      id: schema.tournaments.id,
      slug: schema.tournaments.slug,
      name: schema.tournaments.name,
      entriesOpen: schema.tournaments.entriesOpen,
      consolationDraws: schema.tournaments.consolationDraws,
    })
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
  const organizationId = await guard('tournaments:manage');

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
      /*
       * Asked at creation because it is a promise to the field — "everyone
       * gets at least two matches" — and it has to be decided before the
       * draws are generated. Changing it afterwards does nothing to a
       * bracket that already exists.
       */
      consolationDraws: formData.get('consolationDraws') === 'on',
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
  const organizationId = await guard('tournaments:manage');
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
  const organizationId = await guard('destructive');
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
  const organizationId = await guard('draws:manage');
  const slug = String(formData.get('slug') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const discipline = String(formData.get('discipline') ?? '');
  const division = String(formData.get('division') ?? 'open');
  const format = String(formData.get('format') ?? 'singleElimination');

  if (discipline !== 'singles' && discipline !== 'doubles') return;
  if (!['open', 'mens', 'womens'].includes(division)) return;
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
        eq(schema.events.division, division as 'open'),
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
      division: division as 'open',
      format: format as 'roundRobin',
      status: 'draft',
    });
  }

  revalidatePath(`/admin/${slug}`);
}

export async function setEventFormat(formData: FormData): Promise<void> {
  const organizationId = await guard('draws:manage');
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
  const organizationId = await guard('draws:manage');
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
  const organizationId = await guard('entrants:write');
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

/**
 * Advance the tournament one step.
 *
 * One button instead of eight. The old page exposed `status` and
 * `visibility` as two independent axes of five and three buttons, left the
 * organizer to keep them consistent, and never said which combination was
 * the normal one — "Draft stage, Public visibility" was reachable and
 * means nothing.
 *
 * The phase is derived (lib/tournament-phase.ts), so this writes the
 * underlying columns to whatever the next phase implies and the derived
 * value follows. Visibility rides along with the step that earns it:
 * opening entries is exactly the moment a tournament should become
 * findable, so it is not a second decision.
 */
export async function advancePhase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = await guard('tournaments:manage');
  const slug = String(formData.get('slug') ?? '');
  const from = String(formData.get('phase') ?? '');

  const tournament = await tournamentBySlug(organizationId, slug);
  if (tournament === undefined) return { error: 'Tournament not found.' };

  switch (from) {
    case 'setup':
      await db()
        .update(schema.tournaments)
        .set({
          entriesOpen: true,
          /*
           * The STAGE advances; the VISIBILITY does not. OT-11.
           *
           * This used to set `visibility: 'public'` too, on the reasoning
           * that "opening entries IS publishing — a tournament taking
           * sign-ups nobody can find is not a state worth reaching". That
           * reasoning is wrong, and the entry page says so in its own
           * header comment: registration deliberately does NOT require
           * visibility, because the normal order is gather entrants, make
           * the draws, THEN publish. The sign-up link is how people find
           * it; the homepage is not.
           *
           * So one click on a panel that said "Open entries" also put a
           * draft on the public homepage, with no draws in it, and nothing
           * in the label warned of that. An organizer who wanted sign-ups
           * from a WhatsApp link had no way to get them without going
           * public.
           *
           * `status` still moves draft → published, and that is not the
           * same coupling: `phaseOf` has no other way to tell "entries
           * have never been opened" from "entries were opened and closed
           * again" — both are entriesOpen: false — and OT-11 rules out a
           * migration to store that properly. Stage means the tournament
           * is real and running. Visibility alone decides who can see it,
           * and it is now left entirely to the organizer.
           *
           * Note for whoever revisits this: 'unlisted' is NOT a middle
           * ground. `listTournaments()` selects ['public', 'unlisted'], so
           * an unlisted tournament is on the homepage too.
           */
          status: 'published',
          updatedAt: new Date(),
        })
        .where(eq(schema.tournaments.id, tournament.id));
      break;

    case 'entries':
      await db()
        .update(schema.tournaments)
        .set({ entriesOpen: false, updatedAt: new Date() })
        .where(eq(schema.tournaments.id, tournament.id));
      break;

    case 'draws':
      // Delegated, so the one-way-door guard and its reporting are not
      // duplicated here.
      return generateDraws({}, formData);

    case 'play':
      await db()
        .update(schema.tournaments)
        .set({ status: 'complete', updatedAt: new Date() })
        .where(eq(schema.tournaments.id, tournament.id));
      break;

    default:
      return { error: 'Nothing to do.' };
  }

  revalidatePath(`/admin/${slug}`);
  revalidatePath('/', 'layout');
  return { ok: 'Done.' };
}

/**
 * Whether this draw ends with a third-place playoff.
 *
 * Per DRAW rather than per tournament, which is how clubs actually decide
 * it: the C+ singles plays one off because there is a trophy for it, and
 * the D doubles does not. `generateDraws` already reads the column — it
 * simply had no way to be set.
 *
 * Only meaningful before the draw is generated. Afterwards the playoff
 * either exists as a round or it does not, and adding one would mean
 * regenerating.
 */
export async function setThirdPlacePlayoff(formData: FormData): Promise<void> {
  const organizationId = await guard('draws:manage');
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const on = String(formData.get('thirdPlacePlayoff') ?? '') === 'on';

  await db()
    .update(schema.events)
    .set({ thirdPlacePlayoff: on, updatedAt: new Date() })
    .where(and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)));

  revalidatePath(`/admin/${slug}`);
}

/* ------------------------------------------------------------------------- */
/* ADM-12: manual slot override                                               */
/* ------------------------------------------------------------------------- */

/**
 * Put a specific entrant in a specific first-round slot.
 *
 * The generator is random within the seeding rules, and sometimes that is
 * wrong for reasons it cannot know: two people from the same family drawn
 * against each other in round one, or somebody who can only play Saturday.
 * The director fixes it by hand and the draw records that it was touched —
 * `entrants.manuallyAdjusted`, a column that has existed since DB-2 and has
 * never been written.
 *
 * Implemented as a SWAP, not a move. Every first-round slot is occupied, so
 * putting A where B is must put B somewhere; silently dropping B is how an
 * entrant vanishes from a tournament they paid for.
 *
 * Refused once any match has a result, for the same reason redrawing is:
 * the bracket below a played match is no longer rearrangeable without
 * throwing that result away.
 */
export async function swapSlots(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = await guard('draws:manage');
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const sideId = String(formData.get('sideId') ?? '');
  const entrantId = String(formData.get('entrantId') ?? '');
  if (sideId === '' || entrantId === '') return { error: 'Pick an entrant.' };

  const played = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(and(eq(schema.matches.eventId, eventId), isNotNull(schema.matches.winnerEntrantId)));
  if ((played[0]?.n ?? 0) > 0) {
    return { error: 'A result has been recorded in this draw. Clear it before moving anyone.' };
  }

  // The slot being written to, and whoever currently sits there.
  const [target] = await db()
    .select({ id: schema.matchSides.id, entrantId: schema.matchSides.entrantId })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(and(eq(schema.matchSides.id, sideId), eq(schema.matches.eventId, eventId)))
    .limit(1);
  if (target === undefined) return { error: 'That slot is not in this draw.' };
  if (target.entrantId === entrantId) return { ok: 'No change.' };

  // Where the incoming entrant currently sits, if anywhere in this draw.
  const [source] = await db()
    .select({ id: schema.matchSides.id })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .where(and(eq(schema.matchSides.entrantId, entrantId), eq(schema.matches.eventId, eventId)))
    .limit(1);

  await db().transaction(async (tx) => {
    await tx
      .update(schema.matchSides)
      .set({ entrantId, updatedAt: new Date() })
      .where(eq(schema.matchSides.id, sideId));

    if (source !== undefined) {
      // The displaced entrant takes the incoming one's old slot. Null is a
      // legitimate value here: an empty slot swapping into a bye.
      await tx
        .update(schema.matchSides)
        .set({ entrantId: target.entrantId, updatedAt: new Date() })
        .where(eq(schema.matchSides.id, source.id));
    }

    // The flag lives on the EVENT, not the entrant: what stops being true
    // is "this draw is exactly what the generator produced", which is a
    // fact about the draw. Reproducing it from drawRandomSeed would no
    // longer give the bracket people actually played.
    await tx
      .update(schema.events)
      .set({ manuallyAdjusted: true, updatedAt: new Date() })
      .where(
        and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)),
      );
  });

  revalidatePath(`/admin/${slug}`);
  revalidatePath('/', 'layout');
  return { ok: 'Moved. The draw is marked as adjusted by hand.' };
}

/* ------------------------------------------------------------------------- */
/* ADM-7b: CSV import                                                         */
/* ------------------------------------------------------------------------- */

export interface ImportPreview extends ActionState {
  /** Header row, for the mapping dropdowns. */
  readonly header?: readonly string[];
  /** One guess per column, which the admin can change before importing. */
  readonly mapping?: readonly ImportField[];
  /** First few data rows, so the mapping can be checked against real values. */
  readonly sample?: ReadonlyArray<readonly string[]>;
  /** The parsed file, carried through the mapping step. */
  readonly payload?: string;
}

/**
 * Step one: read the file and GUESS the columns.
 *
 * Two steps rather than one because no heuristic survives every club's
 * spreadsheet. A one-shot importer that guesses wrong silently creates
 * forty entrants named after an email address, and the only way back is
 * deleting them one at a time.
 */
export async function previewCsv(
  _prev: ImportPreview,
  formData: FormData,
): Promise<ImportPreview> {
  await guard('entrants:write');
  const file = formData.get('file');
  const pasted = String(formData.get('pasted') ?? '');

  const text =
    file instanceof File && file.size > 0 ? await file.text() : pasted;
  if (text.trim() === '') return { error: 'Choose a CSV file, or paste one in.' };

  const rows = parseCsv(text);
  const header = rows[0];
  if (header === undefined || rows.length < 2) {
    return { error: 'That file has a header but no rows.' };
  }

  return {
    header,
    mapping: guessMapping(header),
    sample: rows.slice(1, 4),
    payload: text,
    ok: `${rows.length - 1} ${rows.length - 1 === 1 ? 'row' : 'rows'} read. Check the columns below.`,
  };
}

/**
 * Step two: import using the mapping the admin confirmed.
 *
 * Reuses nothing from the paste parser on purpose — a CSV has real columns,
 * so there is no name-shape guessing to do. A row missing a name is
 * reported rather than imported half-formed.
 */
export async function importCsv(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = await guard('entrants:write');
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const payload = String(formData.get('payload') ?? '');
  const mapping = formData.getAll('mapping').map((m) => String(m) as ImportField);

  const [event] = await db()
    .select({ id: schema.events.id, discipline: schema.events.discipline })
    .from(schema.events)
    .where(and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)))
    .limit(1);
  if (event === undefined) return { error: 'Draw not found.' };

  const nameColumn = mapping.indexOf('fullName');
  if (nameColumn === -1) return { error: 'Say which column holds the name.' };

  const rows = parseCsv(payload).slice(1);
  const at = (row: readonly string[], field: ImportField): string => {
    const index = mapping.indexOf(field);
    return index === -1 ? '' : (row[index] ?? '').trim();
  };

  let added = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    const fullName = (row[nameColumn] ?? '').trim();
    if (fullName === '') {
      skipped.push(`row ${rows.indexOf(row) + 2}: no name`);
      continue;
    }
    const partnerName = at(row, 'partnerName');
    if (event.discipline === 'doubles' && partnerName === '') {
      skipped.push(`${fullName}: no partner`);
      continue;
    }

    const rawSeed = at(row, 'seed');
    const seed = /^\d{1,3}$/.test(rawSeed) ? Number(rawSeed) : null;

    const [entrant] = await db()
      .insert(schema.entrants)
      .values({
        organizationId,
        eventId,
        status: 'active',
        ...(seed !== null ? { seed } : {}),
        ...(at(row, 'email') !== '' ? { contactEmail: at(row, 'email') } : {}),
        ...(at(row, 'phone') !== '' ? { contactPhone: at(row, 'phone') } : {}),
      })
      .returning({ id: schema.entrants.id });
    if (entrant === undefined) continue;

    const people = event.discipline === 'doubles' ? [fullName, partnerName] : [fullName];
    for (const [position, who] of people.entries()) {
      const { firstName, lastName } = splitName(who);
      const [player] = await db()
        .insert(schema.players)
        .values({
          organizationId,
          firstName,
          lastName,
          ...(position === 0 && at(row, 'email') !== '' ? { email: at(row, 'email') } : {}),
          ...(position === 0 && at(row, 'phone') !== '' ? { phone: at(row, 'phone') } : {}),
        })
        .returning({ id: schema.players.id });
      if (player === undefined) continue;
      await db()
        .insert(schema.entrantPlayers)
        .values({ entrantId: entrant.id, playerId: player.id, position });
    }
    added += 1;
  }

  revalidatePath(`/admin/${slug}`);

  if (skipped.length > 0) {
    return {
      ok: `Imported ${added}.`,
      error: `${skipped.length} skipped — ${skipped.slice(0, 3).join('; ')}`,
    };
  }
  return { ok: `Imported ${added} ${added === 1 ? 'entrant' : 'entrants'}.` };
}

export async function clearEntrants(formData: FormData): Promise<void> {
  const organizationId = await guard('entrants:write');
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
  const organizationId = await guard('tournaments:manage');
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
  const organizationId = await guard('entrants:write');
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
  const organizationId = await guard('entrants:write');
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
    seed: number | null;
    selfRegistered: boolean;
    /** The `?src=` label of the QR code or link they entered through. */
    source: string | null;
    /** 'paid' | 'pending' | 'unpaid'. Pending means OXXO/SPEI not yet cleared. */
    payment: 'paid' | 'pending' | 'unpaid';
    paymentMethod: string | null;
  }>
> {
  const rows = await db()
    .select({
      id: schema.entrants.id,
      paid: schema.entrants.paid,
      sourceLabel: schema.entrants.sourceLabel,
      seed: schema.entrants.seed,
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

  // One query for every pending payment in this event, rather than one per row.
  const pendingRows = await db()
    .select({ entrantId: schema.payments.entrantId, method: schema.payments.method })
    .from(schema.payments)
    .innerJoin(schema.entrants, eq(schema.entrants.id, schema.payments.entrantId))
    .where(and(eq(schema.entrants.eventId, eventId), eq(schema.payments.status, 'pending')));
  const pendingBy = new Map(pendingRows.map((r) => [r.entrantId, r.method]));

  const byEntrant = new Map<
    string,
    {
      id: string;
      names: string[];
      email: string | null;
      phone: string | null;
      paid: boolean;
      seed: number | null;
      source: string | null;
    }
  >();
  for (const r of rows) {
    const entry = byEntrant.get(r.id) ?? {
      id: r.id,
      names: [],
      email: r.email,
      phone: r.phone,
      paid: r.paid,
      seed: r.seed,
      source: r.sourceLabel,
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
    seed: e.seed,
    payment: e.paid ? ('paid' as const) : pendingBy.has(e.id) ? ('pending' as const) : ('unpaid' as const),
    paymentMethod: pendingBy.get(e.id) ?? null,
    // An admin-typed entrant has no contact details; a self-registered one does.
    selfRegistered: e.email !== null,
    source: e.source,
  }));
}

/* ------------------------------------------------------------------------- */
/* Draw generation                                                           */
/* ------------------------------------------------------------------------- */

/**
 * Generating a draw is a ONE-WAY DOOR.
 *
 * It used to call clearDraw() unconditionally, so a second click on the same
 * button silently destroyed the existing bracket and every result hanging off
 * it — and the single-event path had no status filter at all, so it would do
 * that to a tournament already in progress. There was no confirmation, and
 * the button sat next to "Entrants" in the grid.
 *
 * Two rules now, both enforced HERE rather than only in the UI, because a
 * disabled button is a suggestion and this is a destructive operation:
 *
 *   1. Registration must be closed. A draw made while entries are still open
 *      is wrong the moment the next person signs up.
 *   2. An event that already has a draw is never redrawn by this action. It
 *      is skipped and reported, not overwritten.
 *
 * Redoing a draw is `redrawEvent`, which is deliberate, typed-confirmed, and
 * refuses outright once results exist.
 */
export async function generateDraws(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = await guard('draws:manage');
  const slug = String(formData.get('slug') ?? '');
  const onlyEventId = String(formData.get('eventId') ?? '');

  const tournament = await tournamentBySlug(organizationId, slug);
  if (tournament === undefined) return { error: 'Tournament not found.' };

  if (tournament.entriesOpen) {
    return {
      error:
        'Registration is still open. Close entries first — a draw made now is out of date as soon as the next person signs up.',
    };
  }

  const events = await db()
    .select({
      id: schema.events.id,
      format: schema.events.format,
      status: schema.events.status,
      code: schema.categories.code,
      discipline: schema.events.discipline,
      division: schema.events.division,
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
  const alreadyDrawn: string[] = [];
  const unpaidNotes: string[] = [];
  const consolationNotes: string[] = [];

  for (const event of events) {
    const label =
      event.division === 'open'
        ? `${event.code} ${event.discipline}`
        : `${event.code} ${event.division === 'mens' ? "men's" : "women's"} ${event.discipline}`;
    const drawn = await db()
      .select({ n: count(schema.matches.id) })
      .from(schema.matches)
      .where(eq(schema.matches.eventId, event.id));
    if ((drawn[0]?.n ?? 0) > 0) {
      alreadyDrawn.push(label);
      continue;
    }

    const entrants = await loadEntrantsForEngine(db(), organizationId, event.id);

    // Two is the minimum real draw. Below that there is nothing to generate,
    // and saying so beats an empty bracket an organizer has to interpret.
    if (entrants.length < 2) {
      skipped.push(`${label} (${entrants.length} entrants)`);
      continue;
    }

    // Advisory only: a director routinely lets someone play and settle up
    // after, and an OXXO payment can take a day to clear.
    const unpaidRows = await db()
      .select({ n: count(schema.entrants.id) })
      .from(schema.entrants)
      .where(
        and(
          eq(schema.entrants.eventId, event.id),
          eq(schema.entrants.status, 'active'),
          eq(schema.entrants.paid, false),
        ),
      );
    const unpaid = unpaidRows[0]?.n ?? 0;
    if (unpaid > 0) unpaidNotes.push(`${label}: ${unpaid} unpaid`);

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

      const entrantIdMap = new Map(engineEntrants.map((e) => [e.id, e.id]));
      const persisted = await persistDraw({
        db: db(),
        organizationId,
        tournamentId: tournament.id,
        eventId: event.id,
        stage,
        entrantIdMap,
      });

      /*
       * The consolation draw, when the club asked for one.
       *
       * Generated from the main draw's STRUCTURE, after it, and persisted
       * as a second stage pointing back at the first. `externalMatchIds`
       * is what lets its `loserOf` refs resolve into the main draw's rows
       * — without it every feed would be null and nobody would ever
       * arrive in the second bracket.
       *
       * Round robins have no first round to lose in, so they are skipped
       * rather than refused: a club that runs both formats should not
       * have the whole generation fail because of the setting.
       */
      if (tournament.consolationDraws && event.format !== 'roundRobin') {
        const consolation = generateConsolation(stage);
        if (consolation === null) {
          consolationNotes.push(`${label}: too few first-round losers`);
        } else {
          await persistDraw({
            db: db(),
            organizationId,
            tournamentId: tournament.id,
            eventId: event.id,
            stage: consolation.stage,
            entrantIdMap,
            sortOrder: 1,
            stageName: 'Consolation',
            parentStageId: persisted.stageId,
            externalMatchIds: persisted.matchIdByEngineId,
          });
          consolationNotes.push(`${label}: ${consolation.feederCount}-player consolation`);
        }
      }

      done.push(label);
    } catch (error) {
      skipped.push(`${label} (${error instanceof Error ? error.message : 'failed'})`);
    }
  }

  revalidatePath(`/admin/${slug}`);
  revalidatePath('/', 'layout');

  if (done.length === 0) {
    if (alreadyDrawn.length > 0 && skipped.length === 0) {
      return {
        error: `Already drawn: ${alreadyDrawn.join(', ')}. Use "redraw" on the draw's own page to replace one.`,
      };
    }
    return { error: `Nothing generated. ${[...skipped, ...alreadyDrawn].join('; ')}` };
  }
  const notes = [
    ...(skipped.length > 0 ? [`Skipped ${skipped.join('; ')}`] : []),
    ...(alreadyDrawn.length > 0 ? [`Left alone, already drawn: ${alreadyDrawn.join(', ')}`] : []),
    ...(unpaidNotes.length > 0
      ? [`Drawn with unpaid entrants — ${unpaidNotes.join('; ')}`]
      : []),
    ...(consolationNotes.length > 0 ? [consolationNotes.join('; ')] : []),
  ];

  return {
    ok: `Generated ${done.length} ${done.length === 1 ? 'draw' : 'draws'}: ${done.join(', ')}.`,
    ...(notes.length > 0 ? { error: notes.join('. ') } : {}),
  };
}

/**
 * Single-cell variant for a plain form, where there is no useActionState to
 * carry a result. Errors surface as the cell's state rather than a message.
 */
export async function generateDrawForEvent(formData: FormData): Promise<void> {
  await generateDraws({}, formData);
}

/**
 * Throw a draw away so it can be made again.
 *
 * The only route back through the one-way door, and deliberately awkward:
 *
 *   - The draw's name has to be typed, the same confirmation the tournament
 *     delete uses. A dialog that needs one click gets dismissed on reflex.
 *   - It REFUSES once any result exists. Redrawing then would delete real
 *     match history — scores, winners, the lot — to solve a problem that is
 *     almost never "the draw is wrong" at that point. Clearing those results
 *     first is a separate, visible act on the scores page.
 *
 * Entrants and seeds are untouched: `clearDraw` deletes the stage, and the
 * bracket cascades from it. The people stay, the pairings go.
 */
export async function redrawEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = await guard('draws:manage');
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const confirmLabel = String(formData.get('confirmLabel') ?? '').trim();
  const expectedLabel = String(formData.get('expectedLabel') ?? '').trim();

  if (expectedLabel === '' || confirmLabel.toLowerCase() !== expectedLabel.toLowerCase()) {
    return { error: `Type "${expectedLabel}" to confirm.` };
  }

  const tournament = await tournamentBySlug(organizationId, slug);
  if (tournament === undefined) return { error: 'Tournament not found.' };

  const eventRows = await db()
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)))
    .limit(1);
  if (eventRows[0] === undefined) return { error: 'Draw not found.' };

  // A recorded winner is the signal that play has started. Checking matches
  // rather than score_events means a result entered and then cleared does
  // not lock the draw forever.
  const played = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(and(eq(schema.matches.eventId, eventId), isNotNull(schema.matches.winnerEntrantId)));

  if ((played[0]?.n ?? 0) > 0) {
    return {
      error: `${played[0]?.n} ${played[0]?.n === 1 ? 'match has' : 'matches have'} a result. Clear those results first — redrawing would delete them.`,
    };
  }

  await clearDraw(db(), organizationId, eventId);

  revalidatePath(`/admin/${slug}`);
  revalidatePath('/', 'layout');

  return { ok: `Draw deleted. ${expectedLabel} can be generated again.` };
}

/* ------------------------------------------------------------------------- */
/* Scoring format                                                             */
/* ------------------------------------------------------------------------- */

/**
 * Set how a draw is scored.
 *
 * The six columns have existed on `events` since DB-2 and the engine has
 * always honoured them, but nothing ever wrote them — so every draw in the
 * product silently ran on the defaults (best of 3, sets to 6, tiebreak at
 * 6-6 to 7, advantage scoring) whatever the club actually played.
 *
 * Presets come from the ENGINE, not from a copy here. It already defines
 * best of 3, match tiebreak, best of 5, pro set to 8, a single set to 6,
 * Fast4 and advantage sets, and a second list would drift from the rules
 * that validate the scores.
 */
export async function setEventScoring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = await guard('draws:manage');
  const slug = String(formData.get('slug') ?? '');
  const eventId = String(formData.get('eventId') ?? '');
  const preset = String(formData.get('preset') ?? '');

  const format = SCORING_PRESETS[preset as ScoringPresetName];
  if (format === undefined) return { error: 'Unknown scoring format.' };

  await db()
    .update(schema.events)
    .set({
      setsToWin: format.setsToWin,
      gamesPerSet: format.gamesPerSet,
      tiebreakAt: format.tiebreakAt,
      tiebreakTo: format.tiebreakTo,
      decidingSetMode: format.decidingSetMode,
      adScoring: format.adScoring,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.events.organizationId, organizationId), eq(schema.events.id, eventId)));

  revalidatePath(`/admin/${slug}`);
  return { ok: 'Scoring format saved.' };
}

/**
 * Give one round its own scoring, or clear it back to the draw's.
 *
 * This is the "the final is best of three, the rest are pro sets" case. It
 * is per ROUND rather than per match because that is the shape of the real
 * request — and because a final IS one match, so the round override covers
 * it exactly. `rounds.scoring_override` is read through
 * `resolveScoringFormat`, which already falls back to the event.
 */
export async function setRoundScoring(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = await guard('draws:manage');
  const slug = String(formData.get('slug') ?? '');
  const roundId = String(formData.get('roundId') ?? '');
  const preset = String(formData.get('preset') ?? '');

  // The empty option means "same as the draw", which is a clear, not a set.
  if (preset === '') {
    await db()
      .update(schema.rounds)
      .set({ scoringOverride: null, updatedAt: new Date() })
      .where(and(eq(schema.rounds.organizationId, organizationId), eq(schema.rounds.id, roundId)));
    revalidatePath(`/admin/${slug}`);
    return { ok: 'Round follows the draw again.' };
  }

  const format = SCORING_PRESETS[preset as ScoringPresetName];
  if (format === undefined) return { error: 'Unknown scoring format.' };

  await db()
    .update(schema.rounds)
    .set({ scoringOverride: format, updatedAt: new Date() })
    .where(and(eq(schema.rounds.organizationId, organizationId), eq(schema.rounds.id, roundId)));

  revalidatePath(`/admin/${slug}`);
  return { ok: 'Round scoring saved.' };
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

  /*
   * OT-8. PLAYABLE matches — byes excluded.
   *
   * This counted every row in `matches`, and a bye is a row in `matches`.
   * So the manage page reported "57 matches / 3 of 57 played" on a
   * tournament whose schedule, results and order of play all said 35: the
   * first number an organizer sees, on the page they run the tournament
   * from, was the only one that included 22 matches nobody plays. The
   * progress denominator could never be reached.
   *
   * `lib/match-counts.ts` holds the definitions; this is the same `status
   * !== 'bye'` rule expressed in SQL because the count is aggregated in
   * the database rather than in JS.
   */
  const matchRows = await db()
    .select({ eventId: schema.matches.eventId, n: count(schema.matches.id) })
    .from(schema.matches)
    .where(
      and(eq(schema.matches.tournamentId, tournamentId), ne(schema.matches.status, 'bye')),
    )
    .groupBy(schema.matches.eventId);

  const out = new Map<string, { entrants: number; matches: number }>();
  for (const r of entrantRows) out.set(r.eventId, { entrants: r.n, matches: 0 });
  for (const r of matchRows) {
    out.set(r.eventId, { entrants: out.get(r.eventId)?.entrants ?? 0, matches: r.n });
  }
  return out;
}
