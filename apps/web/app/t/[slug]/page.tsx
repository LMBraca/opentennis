/**
 * /t/:slug — into the draws, or an overview when there are none.
 *
 * HISTORY, because this route has been both things twice and the reasoning
 * for each is worth keeping.
 *
 * It began as a category grid. The grid was removed by request: its whole
 * job was to let you pick a draw, and the draw page already carries a
 * DrawSwitcher that does the same without a round trip, so it was a
 * mandatory stop between wanting a draw and seeing one. The route
 * redirected to the first draw in ladder order.
 *
 * OT-17 made it a hub again, because QA found what the redirect cost:
 * landing on "Open Singles" tells a visitor nothing about the tournament
 * they scanned a poster for, and a category marked "not held" or not yet
 * generated simply vanished.
 *
 * RV-6 settles it the first way — the stop is not wanted. But the hub is
 * kept as the FALLBACK rather than deleted, which is what makes this
 * different from the original redirect: when no category has a generated
 * draw, there is nothing to redirect to, and the old version dropped the
 * visitor on a bracket that did not exist. Now they get the overview, with
 * dates, entry state, and a status for every category including the ones
 * they cannot click.
 *
 * The ROUTE itself is not optional: /t/:slug is what the club prints on QR
 * codes and posts on social, and the spec promises those keep working for
 * the life of the tournament (PRD §4.4, §9.1). It redirects or it renders;
 * it never 404s for a published tournament.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { tournamentOverview, type OverviewCell } from '@/lib/queries';
import { isCellLinkable, overviewCellState } from '@/lib/overview-cell';
import { drawLabel, drawSegment, type Discipline, type Division } from '@/lib/divisions';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import { SiteNav } from '@/components/site-nav';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill, type Dictionary } from '@/lib/i18n/dictionaries';
import { tournamentDateRange } from '@/lib/venue-time';
import styles from './tournament.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

async function loadTournament(slug: string) {
  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      venue: schema.tournaments.venue,
      startDate: schema.tournaments.startDate,
      endDate: schema.tournaments.endDate,
      visibility: schema.tournaments.visibility,
      entriesOpen: schema.tournaments.entriesOpen,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);
  return rows[0];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await loadTournament(slug);
  const dict = dictionary(await currentLocale());
  return {
    title:
      tournament === undefined || tournament.visibility === 'draft'
        ? dict.notFoundTitle
        : tournament.name,
  };
}

function formatName(format: string, dict: Dictionary): string {
  return format === 'roundRobin' ? dict.roundRobin : dict.singleElim;
}

function Cell({
  slug,
  cell,
  dict,
}: {
  readonly slug: string;
  readonly cell: OverviewCell;
  readonly dict: Dictionary;
}) {
  const state = overviewCellState(cell);
  const label = drawLabel(
    cell.categoryCode,
    cell.division as Division,
    cell.discipline as Discipline,
    dict,
  );
  const href = `/t/${slug}/${cell.categorySlug}/${drawSegment(
    cell.division as Division,
    cell.discipline as Discipline,
  )}`;

  const facts = (
    <>
      <span className={styles.cellFormat}>{formatName(cell.format, dict)}</span>
      {cell.entrantCount > 0 && (
        <span className={styles.cellEntrants}>
          {fill(cell.entrantCount === 1 ? dict.entrantCount1 : dict.entrantCountN, {
            n: String(cell.entrantCount),
          })}
        </span>
      )}
    </>
  );

  /*
   * Only a generated draw is a link. The other three states would open a
   * page saying the same thing the cell already says, which is the dead
   * control OT-15 refused for the same reason.
   */
  if (isCellLinkable(state)) {
    return (
      <li className={styles.cell} data-state={state}>
        <Link className={styles.cellLink} href={href}>
          {label}
        </Link>
        {facts}
      </li>
    );
  }

  return (
    <li className={styles.cell} data-state={state}>
      <span className={styles.cellName}>{label}</span>
      {facts}
      <span className={styles.cellState}>
        {state === 'notHeld'
          ? dict.notHeld
          : state === 'notGenerated'
            ? dict.notGenerated
            : dict.noEntrantsYet}
      </span>
    </li>
  );
}

export default async function TournamentPage({ params }: Params) {
  const { slug } = await params;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const tournament = await loadTournament(slug);

  // A draft tournament is not public. 404 rather than 403: the existence of
  // an unpublished draw is itself not public information.
  if (tournament === undefined || tournament.visibility === 'draft') notFound();

  const cells = await tournamentOverview(tournament.id);

  /*
   * Nothing at all to show and entries open: send them to the form rather
   * than to an empty page explaining that it is empty.
   */
  if (cells.length === 0 && tournament.entriesOpen) redirect(`/t/${slug}/enter`);

  /*
   * RV-6, and the second time this call has been made: straight to the
   * draws. The hub is a mandatory stop between wanting a draw and seeing
   * one, and the DrawSwitcher on the draw page already moves between
   * categories without a round trip.
   *
   * The overview below is NOT dead code. It is what a visitor gets when
   * there is no draw to send them to — entries still open, or every
   * category not yet generated — which is exactly the case the old
   * unconditional redirect handled worst: it dropped them on a bracket
   * that did not exist, or on an unrelated category's.
   */
  const firstPlayable = [...cells]
    .sort((a, b) => a.categoryRank - b.categoryRank)
    .find((cell) => isCellLinkable(overviewCellState(cell)));
  if (firstPlayable !== undefined) {
    redirect(
      `/t/${slug}/${firstPlayable.categorySlug}/${drawSegment(
        firstPlayable.division as Division,
        firstPlayable.discipline as Discipline,
      )}`,
    );
  }

  const dates = tournamentDateRange(tournament.startDate, tournament.endDate, locale);
  const byCategory = new Map<string, OverviewCell[]>();
  for (const cell of cells) {
    const group = byCategory.get(cell.categoryCode) ?? [];
    group.push(cell);
    byCategory.set(cell.categoryCode, group);
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title={tournament.name}
        nav={<SiteNav dict={dict} />}
        actions={<LanguageToggle active={locale} />}
        facts={[
          ...(dates !== null ? [{ value: dates, label: dict.dates }] : []),
          ...(tournament.venue !== null ? [{ value: tournament.venue, label: dict.venue }] : []),
        ]}
      />

      <PageBody>
        {/*
          Entry state, and the call to action only when there is something
          to act on. OT-16's closed page is one click away and says the
          same thing, so an "Inscribirme" button that leads to
          "Inscripciones cerradas" is a wasted trip.
        */}
        <p className={styles.entryState}>
          {tournament.entriesOpen ? dict.entriesOpenLabel : dict.entriesClosed}
          {tournament.entriesOpen && (
            <Link className={styles.enterCta} href={`/t/${slug}/enter`}>
              {dict.enterButton}
            </Link>
          )}
        </p>

        {cells.length === 0 ? (
          <p className={styles.empty}>{dict.noDraws}</p>
        ) : (
          /*
            Grouped by category, each group a short list of its disciplines.
            Not a table: at 390px a table of categories scrolls sideways,
            and the design system says a phone gets a vertical list. One
            structure for both widths rather than two in the DOM — there are
            at most a dozen cells, so there is nothing to gain from hiding
            half of them behind a media query.
          */
          <ul className={styles.groups}>
            {[...byCategory.entries()].map(([code, group]) => (
              <li key={code} className={styles.group}>
                <h2 className={styles.groupTitle}>{code}</h2>
                <ul className={styles.cells}>
                  {group.map((cell) => (
                    <Cell
                      key={`${cell.categorySlug}-${cell.discipline}-${cell.division}`}
                      slug={slug}
                      cell={cell}
                      dict={dict}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <SiteFooter />
      </PageBody>
    </main>
  );
}
