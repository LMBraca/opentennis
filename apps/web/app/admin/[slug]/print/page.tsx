/**
 * OUT-1 — printable draw sheets for a whole tournament.
 *
 * One page per draw, because the job this does is "print the draws and put
 * them on the wall", not "print this one draw". An organizer doing it draw by
 * draw would visit four pages and hit print four times.
 *
 * Deliberately no print BUTTON and no client JavaScript: the browser's own
 * print command already exists on every platform, and the QR sheet set this
 * precedent. A `window.print()` button would make this the only admin page
 * that ships JS to do something the browser does for free.
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
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { DrawSheet } from '@/components/draw-sheet';
import { PageHeader, PageBody } from '@/components/page-header';
import adminStyles from '../../admin.module.css';
import styles from './print.module.css';

export const metadata: Metadata = { title: 'Draw sheets · Admin' };
export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
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
  const sheets = loaded.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title="Draw sheets"
        lead={
          sheets.length === 0
            ? 'There are no draws to print yet. Generate a draw first.'
            : 'One sheet per draw, each on its own page. Print in landscape.'
        }
        facts={[{ value: sheets.length, label: sheets.length === 1 ? 'sheet' : 'sheets' }]}
      />

      <PageBody>
        {sheets.length > 0 && (
          <p className={styles.note}>
            Each slot sits on a ruled line with the right-hand end left clear, so scores can be
            written in as matches finish. The sheets are vector drawings and scale to whatever
            paper you load. They are in {dict.localeName} — switch language on a draw page to
            print them in the other one.
          </p>
        )}

        <div className={styles.sheets}>
          {sheets.map(({ key, draw }) => (
            <div key={key} className={styles.sheet}>
              <DrawSheet
                title={drawLabel(draw.category.code, draw.division, draw.discipline, dict)}
                tournamentName={tournament.name}
                meta={[
                  ...(tournament.venue !== null ? [tournament.venue] : []),
                  ...(dates !== null ? [dates] : []),
                  // Lowercased because it follows a number mid-phrase:
                  // "16 entrants", "16 inscritos". The dictionary stores the
                  // standalone label, which is capitalised. Both locales take
                  // the plural for zero.
                  `${draw.entrantCount} ${
                    draw.entrantCount === 1 ? dict.entrant.toLowerCase() : dict.entrants.toLowerCase()
                  }`,
                ]}
                kind={draw.stage?.kind ?? null}
                rounds={draw.rounds}
                groups={draw.groups}
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
