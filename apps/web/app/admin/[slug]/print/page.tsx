/**
 * OUT-1 — printable draw sheets for a whole tournament.
 *
 * One page per draw, because the job this does is "print the draws and put
 * them on the wall", not "print this one draw". An organizer doing it draw by
 * draw would visit four pages and hit print four times.
 *
 * RV-10 added a print button, reversing the original call. That call —
 * no button, no client JS, because the browser's print command exists on
 * every platform — was right about cost and wrong about discoverability.
 * A page that renders a sheet and offers no control was reported as
 * broken, which settles it. See components/print-button.tsx.
 *
 * Uses `loadDrawForAdmin`, not `loadDraw`. The sheet is wanted most before a
 * tournament is published — the public query would hand back null for a draft
 * and print blank paper.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { listDraws, loadDrawForAdmin } from '@/lib/queries';
import { drawLabel, isDivision, type Discipline } from '@/lib/divisions';
import { withoutConsolationPrefix } from '@/lib/bracket-layout';
import { localizeRoundNames } from '@/lib/draw-text';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';
import { DrawSheet } from '@/components/draw-sheet';
import { PageHeader, PageBody } from '@/components/page-header';
import { PrintButton } from '@/components/print-button';
import adminStyles from '../../admin.module.css';
import styles from './print.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: `${dict.drawSheetsTitle} · ${dict.adminEyebrow}` };
}

function isDiscipline(value: string): value is Discipline {
  return value === 'singles' || value === 'doubles';
}

/**
 * "5 November 2026", or a range when the tournament spans days.
 *
 * `timeZone: 'UTC'` is not optional: these are plain calendar dates stored as
 * text, and Tijuana is eight hours west of Greenwich, so local formatting
 * prints the day before.
 */
function formatDateRange(
  locale: string,
  startDate: string | null,
  endDate: string | null,
): string | null {
  const format = (value: string): string =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));

  if (startDate === null && endDate === null) return null;
  if (startDate === null) return format(endDate!);
  if (endDate === null || endDate === startDate) return format(startDate);
  return `${format(startDate)} – ${format(endDate)}`;
}

export default async function PrintPage({ params }: Params) {
  const { slug } = await params;
  await requireUser(`/admin/${slug}/print`);

  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      venue: schema.tournaments.venue,
      startDate: schema.tournaments.startDate,
      endDate: schema.tournaments.endDate,
    })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)))
    .limit(1);

  const tournament = rows[0];
  if (tournament === undefined) notFound();

  const locale = await currentLocale();
  const dict = dictionary(locale);
  const dates = formatDateRange(locale, tournament.startDate, tournament.endDate);

  const drawRows = await listDraws(tournament.id);
  const loaded = await Promise.all(
    drawRows.map(async (row) => {
      if (!isDivision(row.division) || !isDiscipline(row.discipline)) return null;
      const draw = await loadDrawForAdmin(slug, row.categorySlug, row.discipline, row.division);
      if (draw === null) return null;
      return { key: `${row.categorySlug}-${row.division}-${row.discipline}`, draw };
    }),
  );
  /*
   * One sheet per BRACKET, not per draw. A consolation draw is a second
   * bracket that gets played on the same days and wants its own sheet on
   * the same wall — printing only the main one leaves the organizer
   * writing the consolation results onto nothing.
   *
   * It is flattened into the same list rather than appended at the end so
   * a draw and its consolation print consecutively, which is the order
   * they get pinned up in.
   */
  const sheets = loaded
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .flatMap(({ key, draw }) => {
      const main = {
        key,
        draw,
        rounds: localizeRoundNames(draw.rounds, dict),
        consolation: false as const,
        fieldSize: draw.entrantCount,
      };
      if (draw.consolation === null) return [main];
      return [
        main,
        {
          key: `${key}-consolation`,
          draw,
          // The sheet title already carries "Consolation".
          rounds: localizeRoundNames(withoutConsolationPrefix(draw.consolation.rounds), dict),
          consolation: true as const,
          // The first-round losers, not the main draw's entrants.
          fieldSize: draw.consolation.feederCount,
        },
      ];
    });

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title={dict.drawSheetsTitle}
        lead={
          sheets.length === 0
            ? dict.noDrawsToPrint
            : dict.drawSheetsLead
        }
        facts={sheets.length === 0 ? [] : [{
          value: sheets.length === 1
            ? dict.sheetCount1
            : fill(dict.sheetCountN, { n: String(sheets.length) }),
          label: dict.drawSheetsTitle,
        }]}
      />

      <PageBody>
        {sheets.length > 0 && <PrintButton label={dict.printSheets} />}
        {sheets.length > 0 && (
          <p className={styles.note}>
            Each slot sits on a ruled line with the right-hand end left clear, so scores can be
            written in as matches finish. The sheets are vector drawings and scale to whatever
            paper you load. They are in {dict.localeName} — switch language on a draw page to
            print them in the other one.
          </p>
        )}

        <div className={styles.sheets}>
          {sheets.map(({ key, draw, rounds, consolation, fieldSize }) => (
            <div key={key} className={styles.sheet}>
              <DrawSheet
                title={
                  consolation
                    ? `${drawLabel(draw.category.code, draw.division, draw.discipline, dict)} — ${dict.consolation}`
                    : drawLabel(draw.category.code, draw.division, draw.discipline, dict)
                }
                tournamentName={tournament.name}
                meta={[
                  ...(tournament.venue !== null ? [tournament.venue] : []),
                  ...(dates !== null ? [dates] : []),
                  // Lowercased because it follows a number mid-phrase:
                  // "16 entrants", "16 inscritos". The dictionary stores the
                  // standalone label, which is capitalised. Both locales take
                  // the plural for zero.
                  `${fieldSize} ${
                    fieldSize === 1 ? dict.entrant.toLowerCase() : dict.entrants.toLowerCase()
                  }`,
                ]}
                // A consolation bracket is drawn as a bracket. Passing the
                // stage kind straight through would hand the sheet
                // "consolation", which it has no renderer for.
                kind={consolation ? 'singleElimination' : (draw.stage?.kind ?? null)}
                rounds={rounds}
                groups={consolation ? [] : draw.groups}
                labels={{
                  bye: dict.bye,
                  wonLost: dict.wonLost,
                  notGenerated: dict.notGenerated,
                }}
              />
            </div>
          ))}
        </div>
      </PageBody>
    </main>
  );
}
