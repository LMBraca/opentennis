import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, asc, count, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { requireUser } from '@/lib/auth';
import { db, orgId } from '@/lib/db';
import { drawLabel, parseDrawSegment } from '@/lib/divisions';
import {
  matchingPresetName,
  parseScoringOverride,
  scoringFormatFor,
} from '@/lib/match-result';
import { stripeEnabled } from '@/lib/stripe';
import { listEntrants } from '../../../tournament-actions';
import { EntrantsTable } from './entrants-table';
import { AddEntrants } from './add-entrants';
import { FeePanel } from './fee-panel';
import { PageHeader, PageBody } from '@/components/page-header';
import { CsvImport } from './csv-import';
import { SlotEditor, type SlotRow } from './slot-editor';
import { RedrawPanel } from './redraw-panel';
import { ScoringPanel } from './scoring-panel';
import styles from './entrants.module.css';

export const metadata: Metadata = { title: 'Entrants' };
export const dynamic = 'force-dynamic';

const EN = {
  divisionOpen: 'Open',
  divisionMens: "Men's",
  divisionWomens: "Women's",
  singles: 'Singles',
  doubles: 'Doubles',
};

export default async function EntrantsPage({
  params,
}: {
  readonly params: Promise<{ slug: string; category: string; discipline: string }>;
}) {
  const { slug, category, discipline } = await params;
  await requireUser(`/admin/${slug}/${category}/${discipline}`);
  const organizationId = orgId();

  const parsed = parseDrawSegment(discipline);
  if (parsed === null) notFound();

  const rows = await db()
    .select({
      eventId: schema.events.id,
      format: schema.events.format,
      manuallyAdjusted: schema.events.manuallyAdjusted,
      setsToWin: schema.events.setsToWin,
      gamesPerSet: schema.events.gamesPerSet,
      tiebreakAt: schema.events.tiebreakAt,
      tiebreakTo: schema.events.tiebreakTo,
      decidingSetMode: schema.events.decidingSetMode,
      adScoring: schema.events.adScoring,
      status: schema.events.status,
      entryFeeCents: schema.events.entryFeeCents,
      currency: schema.events.currency,
      tournamentName: schema.tournaments.name,
      categoryCode: schema.categories.code,
    })
    .from(schema.events)
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.events.tournamentId))
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(
      and(
        eq(schema.events.organizationId, organizationId),
        eq(schema.tournaments.slug, slug),
        eq(schema.categories.slug, category),
        eq(schema.events.discipline, parsed.discipline),
        eq(schema.events.division, parsed.division),
      ),
    )
    .limit(1);

  const event = rows[0];
  if (event === undefined) notFound();

  const entrants = await listEntrants(event.eventId);

  // Drives the redraw panel: whether a draw exists at all, and whether any
  // of it has been played. Counting matches rather than trusting event
  // status, because status is set by hand and this guards deletion.
  const drawRows = await db()
    .select({
      total: count(schema.matches.id),
      played: count(schema.matches.winnerEntrantId),
    })
    .from(schema.matches)
    .where(eq(schema.matches.eventId, event.eventId));
  const matchCount = drawRows[0]?.total ?? 0;
  const playedCount = drawRows[0]?.played ?? 0;

  /*
   * ADM-12: the first round's slots. Later rounds are filled by winners, so
   * placing somebody there would invent a result.
   */
  const slotRows = await db()
    .select({
      sideId: schema.matchSides.id,
      position: schema.matchSides.position,
      entrantId: schema.matchSides.entrantId,
      slotIndex: schema.matches.slotIndex,
      roundName: schema.rounds.name,
      roundIndex: schema.rounds.roundIndex,
    })
    .from(schema.matchSides)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchSides.matchId))
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .innerJoin(schema.stages, eq(schema.stages.id, schema.rounds.stageId))
    .where(and(eq(schema.stages.eventId, event.eventId), eq(schema.rounds.roundIndex, 0)))
    .orderBy(asc(schema.matches.slotIndex), asc(schema.matchSides.position));

  const slots: SlotRow[] = slotRows.map((r) => ({
    sideId: r.sideId,
    matchLabel: `${r.roundName} ${r.slotIndex + 1}`,
    position: r.position,
    entrantId: r.entrantId,
  }));

  const slotEntrants = entrants.map((e) => ({ id: e.id, name: e.name }));

  // Scoring: the draw's own format, plus any round that differs from it.
  const drawFormat = scoringFormatFor(event);
  const drawPresetName = matchingPresetName(drawFormat);

  const roundRows = await db()
    .select({
      id: schema.rounds.id,
      name: schema.rounds.name,
      roundIndex: schema.rounds.roundIndex,
      scoringOverride: schema.rounds.scoringOverride,
    })
    .from(schema.rounds)
    .innerJoin(schema.stages, eq(schema.stages.id, schema.rounds.stageId))
    .where(eq(schema.stages.eventId, event.eventId))
    .orderBy(asc(schema.rounds.roundIndex));

  const scoringRounds = roundRows.map((r) => {
    const override = parseScoringOverride(r.scoringOverride);
    const preset = override === null ? null : matchingPresetName(override);
    return {
      id: r.id,
      name: r.name,
      roundIndex: r.roundIndex,
      preset: preset ?? '',
      // Something is stored, but it is not a preset we can name in a dropdown.
      custom: override !== null && preset === null,
    };
  });
  const label = drawLabel(event.categoryCode, parsed.division, parsed.discipline, EN);

  const seeded = entrants.filter((e) => e.seed !== null).length;
  const unpaid = entrants.filter((e) => e.payment === 'unpaid').length;
  const pending = entrants.filter((e) => e.payment === 'pending').length;

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: event.tournamentName }}
        title={label}
        facts={[
          { value: entrants.length, label: entrants.length === 1 ? 'entrant' : 'entrants' },
          { value: seeded, label: 'seeded' },
          { value: unpaid, label: 'unpaid', emphasis: unpaid > 0 },
          ...(pending > 0 ? [{ value: pending, label: 'awaiting' }] : []),
        ]}
      />

      <PageBody>
        <FeePanel
          slug={slug}
          eventId={event.eventId}
          feeCents={event.entryFeeCents}
          currency={event.currency}
          stripeReady={stripeEnabled()}
        />
        <EntrantsTable
          slug={slug}
          eventId={event.eventId}
          entrants={entrants}
          isDoubles={parsed.discipline === 'doubles'}
        />
        <AddEntrants slug={slug} eventId={event.eventId} isDoubles={parsed.discipline === 'doubles'} />

        <CsvImport
          slug={slug}
          eventId={event.eventId}
          isDoubles={parsed.discipline === 'doubles'}
        />

        <SlotEditor
          slug={slug}
          eventId={event.eventId}
          slots={slots}
          entrants={slotEntrants}
          manuallyAdjusted={event.manuallyAdjusted}
          locked={playedCount > 0}
        />

        <ScoringPanel
          slug={slug}
          eventId={event.eventId}
          drawPreset={drawPresetName ?? ''}
          drawCustom={drawPresetName === null}
          rounds={scoringRounds}
        />

        <RedrawPanel
          slug={slug}
          eventId={event.eventId}
          label={label}
          matchCount={matchCount}
          playedCount={playedCount}
        />
      </PageBody>
    </main>
  );
}
