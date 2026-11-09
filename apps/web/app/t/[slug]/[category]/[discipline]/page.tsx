/**
 * A single draw: bracket or round robin, with a switcher to every other draw
 * in the tournament.
 *
 * The view is chosen by STAGE KIND rather than by the event's format field, so
 * a hybrid event's group stage and playoff stage each render correctly without
 * this page needing to know about hybrids.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listDraws, loadDraw } from '@/lib/queries';
import { drawLabel, drawSegment, parseDrawSegment } from '@/lib/divisions';
import { Bracket } from '@/components/bracket';
import { RoundRobinView } from '@/components/round-robin-view';
import { DrawSwitcher } from '@/components/draw-switcher';
import { LanguageToggle } from '@/components/language-toggle';
import { LiveUpdates } from '@/components/live-updates';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader } from '@/components/page-header';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, fill } from '@/lib/i18n/dictionaries';
import styles from './draw.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string; category: string; discipline: string }>;
}

/**
 * The third path segment carries BOTH discipline and division:
 * "singles", "womens-singles", "mens-doubles". Folding them together keeps
 * every URL printed before divisions existed working unchanged.
 */
function parseDiscipline(value: string) {
  return parseDrawSegment(value);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, category, discipline } = await params;
  const dict = dictionary(await currentLocale());
  const d = parseDiscipline(discipline);
  if (d === null) return { title: dict.draw };
  const draw = await loadDraw(slug, category, d.discipline, d.division);
  if (draw === null) return { title: dict.draw };
  const label = drawLabel(draw.category.code, d.division, d.discipline, dict);
  return { title: `${label} · ${draw.tournament.name}` };
}

export default async function DrawPage({ params }: Params) {
  const { slug, category, discipline } = await params;

  const parsed = parseDiscipline(discipline);
  if (parsed === null) notFound();

  const draw = await loadDraw(slug, category, parsed.discipline, parsed.division);
  if (draw === null) notFound();

  const locale = await currentLocale();
  const dict = dictionary(locale);
  const draws = await listDraws(draw.tournament.id);
  const isRoundRobin = draw.stage?.kind === 'roundRobin';
  /*
   * SCR-8: only subscribe while results can still change. A finished or
   * cancelled tournament would otherwise have every visitor hold an open
   * stream, and a poller running, to be told forever that nothing happened.
   */
  const acceptsResults =
    draw.tournament.status === 'published' || draw.tournament.status === 'inProgress';
  /*
   * OT-8. Playable matches in the CONSOLATION draw, for the count printed
   * above that bracket. Byes are excluded: counting `r.matches.length` once
   * announced 31 matches for a 20-entrant draw in a 32 bracket, when 19 get
   * played. The main draw's equivalent count was removed in RV-3.
   */
  const consolationMatchCount =
    draw.consolation?.rounds.reduce(
      (n, r) => n + r.matches.filter((m) => m.status !== 'bye').length,
      0,
    ) ?? 0;

  return (
    <main className={styles.page}>
      {/*
       * RV-3: no lead and no fact tiles. The seeding/byes sentence, the
       * entrant count and the "partidos del cuadro principal" qualifier were
       * all describing what the bracket underneath already shows. A reader
       * who wants the field size counts the lines.
       */}
      <PageHeader
        back={{ href: `/t/${slug}`, label: draw.tournament.name }}
        title={drawLabel(draw.category.code, parsed.division, parsed.discipline, dict)}
        actions={<LanguageToggle active={locale} />}
      />

      <div className={styles.switcher}>
        <DrawSwitcher
          tournamentSlug={slug}
          draws={draws}
          activeCategorySlug={category}
          activeDiscipline={drawSegment(parsed.division, parsed.discipline)}
          labels={dict}
        />
      </div>

      {acceptsResults && (
        <div className={styles.live}>
          <LiveUpdates
            href={`/api/live/${slug}`}
            labels={{
              live: dict.liveAuto,
              reconnecting: dict.liveReconnecting,
              stopped: dict.liveStopped,
            }}
          />
        </div>
      )}

      <section className={styles.body}>
        {draw.stage === null ? (
          <p className={styles.empty}>{dict.notGenerated}</p>
        ) : isRoundRobin ? (
          <RoundRobinView rounds={draw.rounds} dict={dict} />
        ) : (
          <Bracket rounds={draw.rounds} dict={dict} />
        )}

        {/*
          The consolation draw, under the main one rather than beside it.
          Two brackets side by side halves the width each gets, and the
          main draw is what almost everyone opened the page for — this one
          is a second, smaller tournament, so it reads as a section below.

          Rendered as its own <Bracket>: the two are separate chains, and
          handing one renderer both sets of rounds would have it try to
          draw connectors between them.
        */}
        {draw.consolation !== null && (
          <section className={styles.consolation}>
            <h2 className={styles.consolationTitle}>{dict.consolation}</h2>
            {/*
              OT-8. ITS count, not the main draw's. QA saw "7 Partidos"
              over an 8-player consolation — the main draw's number,
              printed above the wrong bracket.
            */}
            <p className={styles.consolationCount}>
              {consolationMatchCount === 1
                ? dict.matchCount1
                : fill(dict.matchCountN, { n: String(consolationMatchCount) })}
            </p>
            {/* RV-2: the explainer is gone. The heading plus the bracket
                underneath carry it; a paragraph of rules above a draw is
                read once and then skipped forever. */}
            {/*
              OT-25. These rounds keep their stage.

              The prefix used to be stripped here, on the reasoning that the
              heading above already says "Cuadro de consolación" and the
              columns need not repeat it. That holds for the heading — and
              fails everywhere else on the page. The two brackets sit on one
              scrolling page, so a column reading "Semifinal" is a quarter
              screen away from the main draw's "Semifinal"; the placeholders
              underneath both shorten to "SF1"; and a player told "Semifinal,
              11:00" cannot tell which of the two they are in. The heading
              scrolls away, the column title is what stays beside the match.
            */}
            <Bracket rounds={draw.consolation.rounds} dict={dict} />
          </section>
        )}

        <SiteFooter />
      </section>
    </main>
  );
}
