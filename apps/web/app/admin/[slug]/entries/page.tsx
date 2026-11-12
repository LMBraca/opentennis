/**
 * ENT-7 — the entry queue.
 *
 * Every public entry is recorded here whether or not the club reviews
 * them, so this doubles as the log of what people actually typed. With
 * review off (the default) entries arrive already accepted and this is a
 * place to spot a duplicate or a typo; with it on, nothing reaches a draw
 * until an organizer says so.
 *
 * ENT-8: the list is sorted by SURNAME, not by arrival. Two spellings of
 * the same person — "Hernandez" and "Hernández", "Berg" entered twice —
 * end up adjacent, which is how you notice them. No badges, no "possible
 * duplicate" flags: the sort order does the work, and a flag that is wrong
 * is worse than no flag.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, count, desc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageHeader, PageBody } from '@/components/page-header';
import { SetupSteps, SetupNext } from '@/components/setup-steps';
import { drawLabel, type Discipline, type Division } from '@/lib/divisions';
import { dictionary, intlLocale } from '@/lib/i18n/dictionaries';
import { currentLocale } from '@/lib/i18n/server';
import { venueTimestampFormatter } from '@/lib/venue-time';
import { EntryQueue, type Submission } from './entry-queue';
import adminStyles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: `${dict.entriesTitle} · ${dict.adminEyebrow}` };
}

interface Params {
  readonly params: Promise<{ slug: string }>;
  /* RV-17: `?setup=1` means this screen is being visited as a wizard step,
     so it shows the path. The screen itself is otherwise unchanged — the
     wizard is a route through the real pages, not a copy of them. */
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Fold accents and case so "Hernández" sorts next to "Hernandez".
 * Comparing raw strings puts them in different parts of the alphabet,
 * which is exactly the pair the organizer needs to see together.
 */
function sortKey(lastName: string, firstName: string): string {
  return `${lastName} ${firstName}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default async function EntriesPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const inSetup = (await searchParams)?.['setup'] === '1';
  await requireUser(`/admin/${slug}/entries`);
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const timestamp = venueTimestampFormatter(intlLocale(locale));

  const tournaments = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
    })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)))
    .limit(1);
  const tournament = tournaments[0];
  if (tournament === undefined) notFound();

  const rows = await db()
    .select({
      id: schema.entrySubmissions.id,
      firstName: schema.entrySubmissions.firstName,
      lastName: schema.entrySubmissions.lastName,
      email: schema.entrySubmissions.email,
      phone: schema.entrySubmissions.phone,
      status: schema.entrySubmissions.status,
      selections: schema.entrySubmissions.selections,
      sourceLabel: schema.entrySubmissions.sourceLabel,
      createdAt: schema.entrySubmissions.createdAt,
    })
    .from(schema.entrySubmissions)
    .where(eq(schema.entrySubmissions.tournamentId, tournament.id))
    .orderBy(desc(schema.entrySubmissions.createdAt));

  const events = await db()
    .select({
      id: schema.events.id,
      code: schema.categories.code,
      discipline: schema.events.discipline,
      division: schema.events.division,
    })
    .from(schema.events)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(eq(schema.events.tournamentId, tournament.id));
  const labelBy = new Map(
    events.map((e) => [
      e.id,
      drawLabel(e.code, e.division as Division, e.discipline as Discipline, dict),
    ]),
  );

  const submissions: Submission[] = rows
    .map((r) => {
      const sel = r.selections as { eventId?: string; partnerName?: string };
      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`.trim(),
        sortKey: sortKey(r.lastName, r.firstName),
        email: r.email,
        phone: r.phone,
        status: r.status,
        drawLabel: labelBy.get(sel.eventId ?? '') ?? 'Unknown draw',
        partnerName: sel.partnerName ?? null,
        source: r.sourceLabel,
        submittedAt: timestamp.format(r.createdAt),
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const pending = submissions.filter((s) => s.status === 'pending');
  const handled = submissions.filter((s) => s.status !== 'pending');

  /*
   * OT-13. Whether any bracket exists yet. "Accepted" can only mean "in the
   * draw" once there is a draw; before that the honest claim is that they
   * will appear in one when it is generated.
   */
  const [matchTally] = await db()
    .select({ n: count(schema.matches.id) })
    .from(schema.matches)
    .where(eq(schema.matches.tournamentId, tournament.id));
  const drawGenerated = (matchTally?.n ?? 0) > 0;

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title={dict.entriesTitle}
        facts={[
          { value: pending.length, label: dict.pendingEntries, emphasis: pending.length > 0 },
          { value: handled.length, label: dict.handledEntries },
        ]}
      />
      <PageBody>
        {inSetup && <SetupSteps slug={slug} active="entries" dict={dict} />}
        {/*
          The review-entries toggle is gone. Entries are always accepted —
          what gates a player is PAYMENT, not an approval step, so a switch
          that held them in a queue was a second gate answering a question
          the club does not ask. Entrants appear immediately and stay out
          of the draw until they are ticked paid.
        */}
        <EntryQueue
          slug={slug}
          pending={pending}
          handled={handled}
          drawGenerated={drawGenerated}
          dict={dict}
        />
        {inSetup && <SetupNext slug={slug} active="entries" dict={dict} />}
      </PageBody>
    </main>
  );
}
