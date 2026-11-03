/**
 * Create a tournament end to end: grid, entrants, draws, persisted matches.
 *
 * Exercises the whole stack in one pass — slug allocation, the category grid,
 * entrant creation, the pure engine, and the persistence seam. This is the
 * first thing that makes the engine and the database talk to each other, so it
 * doubles as the integration test for both.
 *
 * Usage:
 *   pnpm --filter @opentennis/db exec tsx src/scripts/create-tournament.ts "Name"
 */

import { and, asc, eq } from 'drizzle-orm';
import {
  generateRoundRobin,
  generateSingleElimination,
  type Entrant,
  type GeneratedStage,
} from '@opentennis/engine';
import { createDb, type Database } from '../client';
import { categories, entrantPlayers, entrants, events, players, tournaments } from '../schema/core';
import { DEFAULT_FORMAT_BY_CATEGORY } from '../seed-data';
import { isValidSlug, nextAvailableSlug, tournamentSlug } from '../slugs';
import { loadEntrantsForEngine, persistDraw } from '../persist-draw';

/** Plausible club names, so output reads like a real draw sheet. */
const SURNAMES = [
  'Alvarez', 'Chen', 'Okonkwo', 'Reid', 'Raman', 'Novak', 'Diallo', 'Petrov',
  'Haddad', 'Lindqvist', 'Moreau', 'Tanaka', 'Weber', 'Costa', 'Nakamura',
  'Silva', 'Fernandez', 'Kowalski', 'Mbeki', 'Johansson', 'Rossi', 'Dubois',
  'Yilmaz', 'Nguyen', 'Oyelaran', 'Papadopoulos', 'Hassan', 'Berg', 'Ferrari',
  'Vandenberg', 'Kaur', 'Oconnell', 'Schmidt', 'Rivera', 'Thorne', 'Castillo',
  'Ibrahim', 'Novotny', 'Eriksen', 'Baptiste', 'Quintero', 'Walsh', 'Adeyemi',
  'Marchetti', 'Sorensen', 'Villanueva', 'Khan', 'Duarte',
];
const FIRST_NAMES = [
  'Priya', 'Marco', 'Dana', 'Sam', 'Luca', 'Noor', 'Theo', 'Ines', 'Kai',
  'Mira', 'Owen', 'Zara', 'Felix', 'Ana', 'Hugo', 'Elsa',
];

/** Which cells to run, and how big. Mirrors a realistic club grid. */
const GRID: ReadonlyArray<{
  code: string;
  discipline: 'singles' | 'doubles';
  entrants: number;
  seeds: number;
}> = [
  { code: 'Open', discipline: 'singles', entrants: 6, seeds: 2 },
  { code: 'Open', discipline: 'doubles', entrants: 4, seeds: 0 },
  { code: 'A', discipline: 'singles', entrants: 8, seeds: 2 },
  { code: 'B', discipline: 'singles', entrants: 5, seeds: 0 },
  { code: 'C+', discipline: 'singles', entrants: 12, seeds: 4 },
  { code: 'C+', discipline: 'doubles', entrants: 8, seeds: 2 },
  { code: 'C', discipline: 'singles', entrants: 24, seeds: 4 },
  { code: 'D', discipline: 'singles', entrants: 17, seeds: 0 },
];

function personName(i: number): { firstName: string; lastName: string } {
  return {
    firstName: FIRST_NAMES[i % FIRST_NAMES.length] as string,
    lastName: SURNAMES[i % SURNAMES.length] as string,
  };
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  const organizationId = process.env['OPENTENNIS_ORG_ID'];
  const name = process.argv[2] ?? 'Untitled Tournament';

  if (url === undefined || url.trim() === '') throw new Error('DATABASE_URL is not set');
  if (organizationId === undefined || organizationId.trim() === '') {
    throw new Error('OPENTENNIS_ORG_ID is not set');
  }

  const db: Database = createDb(url);
  const log = (s: string): void => {
    console.log(s);
  };

  log(`\n── Creating "${name}" ──\n`);

  /* 1. Slug ------------------------------------------------------------- */

  const existing = await db.select({ slug: tournaments.slug }).from(tournaments);
  const taken = new Set(existing.map((t) => t.slug));
  const desired = tournamentSlug(name, 2026);
  const slug = nextAvailableSlug(desired, (s) => taken.has(s));

  if (!isValidSlug(slug)) throw new Error(`Generated an invalid slug: ${slug}`);
  log(`slug           /t/${slug}${slug === desired ? '' : `  (collision; "${desired}" was taken)`}`);

  /* 2. Tournament ------------------------------------------------------- */

  const [tournament] = await db
    .insert(tournaments)
    .values({
      organizationId,
      name,
      slug,
      venue: 'Riverside Tennis Club',
      timezone: 'America/Los_Angeles',
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      status: 'published',
      visibility: 'public',
      entriesOpen: false,
    })
    .returning({ id: tournaments.id });
  if (tournament === undefined) throw new Error('Failed to create tournament');

  /* 3. Category grid ---------------------------------------------------- */

  const ladder = await db
    .select({ id: categories.id, code: categories.code })
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
    .orderBy(asc(categories.rank));
  const categoryByCode = new Map(ladder.map((c) => [c.code, c.id]));

  log(`\ngrid           ${GRID.length} cells enabled of ${ladder.length * 2} possible\n`);

  let playerCounter = 0;
  let totalMatches = 0;
  const summary: Array<{ cell: string; format: string; entrants: number; matches: number; detail: string }> = [];

  for (const cell of GRID) {
    const categoryId = categoryByCode.get(cell.code);
    if (categoryId === undefined) throw new Error(`Unknown category ${cell.code}`);

    const format = DEFAULT_FORMAT_BY_CATEGORY[cell.code] ?? 'singleElimination';
    const isRoundRobin = format === 'roundRobin';

    const [event] = await db
      .insert(events)
      .values({
        organizationId,
        tournamentId: tournament.id,
        categoryId,
        discipline: cell.discipline,
        format,
        status: 'ready',
        // Open and A play best of 3; the big lower draws use a match tiebreak
        // decider so a 48-player bracket fits in a weekend.
        setsToWin: 2,
        gamesPerSet: 6,
        tiebreakAt: 6,
        tiebreakTo: 7,
        decidingSetMode: cell.code === 'Open' || cell.code === 'A' ? 'standard' : 'matchTiebreak',
        adScoring: true,
        thirdPlacePlayoff: !isRoundRobin,
      })
      .returning({ id: events.id });
    if (event === undefined) throw new Error(`Failed to create event ${cell.code}`);

    /* 4. Players and entrants ------------------------------------------ */

    const perEntrant = cell.discipline === 'doubles' ? 2 : 1;
    const entrantIds: string[] = [];

    for (let e = 0; e < cell.entrants; e++) {
      const [entrant] = await db
        .insert(entrants)
        .values({
          organizationId,
          eventId: event.id,
          // Seeds 1..n for the seeded portion; the rest null. Unseeded is the
          // common case and the engine treats it as first-class.
          seed: e < cell.seeds ? e + 1 : null,
          status: 'active',
        })
        .returning({ id: entrants.id });
      if (entrant === undefined) throw new Error('Failed to create entrant');
      entrantIds.push(entrant.id);

      for (let p = 0; p < perEntrant; p++) {
        const { firstName, lastName } = personName(playerCounter++);
        const [player] = await db
          .insert(players)
          .values({
            organizationId,
            firstName,
            lastName,
            email: `${firstName}.${lastName}.${playerCounter}@example.test`.toLowerCase(),
            phone: `555-01${String(playerCounter).padStart(2, '0')}`,
            clubAffiliation: playerCounter % 3 === 0 ? 'Riverside' : 'Visitor',
          })
          .returning({ id: players.id });
        if (player === undefined) throw new Error('Failed to create player');

        await db
          .insert(entrantPlayers)
          .values({ entrantId: entrant.id, playerId: player.id, position: p });
      }
    }

    /* 5. Generate the draw with the pure engine ------------------------ */

    const engineEntrants: Entrant[] = (
      await loadEntrantsForEngine(db, organizationId, event.id)
    ).map((e): Entrant => ({ id: e.id, seed: e.seed, status: 'active' }));

    const randomSeed = `${slug}|${cell.code}|${cell.discipline}`;
    const stage: GeneratedStage = isRoundRobin
      ? generateRoundRobin({ entrants: engineEntrants, randomSeed, groupName: 'Round robin' })
      : generateSingleElimination({ entrants: engineEntrants, randomSeed, thirdPlacePlayoff: true });

    /* 6. Persist -------------------------------------------------------- */

    const result = await persistDraw({
      db,
      organizationId,
      tournamentId: tournament.id,
      eventId: event.id,
      stage,
      entrantIdMap: new Map(engineEntrants.map((e) => [e.id, e.id])),
    });

    totalMatches += result.matchCount;
    summary.push({
      cell: `${cell.code} ${cell.discipline}`,
      format: isRoundRobin ? 'round robin' : 'single elim',
      entrants: cell.entrants,
      matches: result.matchCount,
      detail: stage.meta.description,
    });
  }

  /* 7. Report ----------------------------------------------------------- */

  const pad = (s: string, n: number): string => s.padEnd(n);
  log(pad('CELL', 18) + pad('FORMAT', 14) + pad('ENTRANTS', 10) + 'MATCHES');
  log('─'.repeat(56));
  for (const r of summary) {
    log(pad(r.cell, 18) + pad(r.format, 14) + pad(String(r.entrants), 10) + String(r.matches));
  }
  log('─'.repeat(56));
  log(pad('TOTAL', 42) + String(totalMatches));

  log('\nDraw descriptions as the admin preview will show them:\n');
  for (const r of summary) log(`  ${r.cell}\n    ${r.detail}`);

  /* 8. Verify by reading back ------------------------------------------- */

  const persisted = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.tournamentId, tournament.id), eq(events.status, 'published')));

  log(`\nverified       ${persisted.length}/${GRID.length} events published`);
  log(`tournament id  ${tournament.id}`);
  log(`public url     /t/${slug}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('\nFailed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
