/**
 * A single draw: bracket or round robin, with a switcher to every other draw
 * in the tournament.
 *
 * The view is chosen by STAGE KIND rather than by the event's format field, so
 * a hybrid event's group stage and playoff stage each render correctly without
 * this page needing to know about hybrids.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listDraws, loadDraw } from '@/lib/queries';
import { drawLabel, drawSegment, parseDrawSegment } from '@/lib/divisions';
import { Bracket } from '@/components/bracket';
import { withoutConsolationPrefix } from '@/lib/bracket-layout';
import { stageSummary } from '@/lib/draw-text';
import { RoundRobinView } from '@/components/round-robin-view';
import { DrawSwitcher } from '@/components/draw-switcher';
import { LanguageToggle } from '@/components/language-toggle';
import { LiveUpdates } from '@/components/live-updates';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader } from '@/components/page-header';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
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
  const matchCount = draw.rounds.reduce((n, r) => n + r.matches.length, 0);
  /*
   * Rebuilt from the stage's stored counts rather than read from the
   * engine's `description`, which is English prose and was printing
   * verbatim above a Spanish draw.
   */
  const summary = draw.stage === null ? null : stageSummary(draw.stage.summary, dict);

  return (
    <main className={styles.page}>
      <PageHeader
        back={{ href: `/t/${slug}`, label: draw.tournament.name }}
        title={drawLabel(draw.category.code, parsed.division, parsed.discipline, dict)}
        {...(summary != null && summary !== '' ? { lead: summary } : {})}
        facts={[
          { value: draw.entrantCount, label: dict.entrants },
          {
            value: matchCount,
            label: matchCount === 1 ? dict.match : dict.matches,
          },
        ]}
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

      <div className={styles.pathLink}>
        {/* PUB-5. Plain text: the design system bans a pasted arrow after
            link text as template chrome. */}
        <Link href={`/t/${slug}/${category}/${discipline}/path`}>{dict.viewPath}</Link>
      </div>

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
              The engine writes an English description into stage config.
              That is organizer-facing detail and this site defaults to
              Spanish, so the public line is translated here rather than
              echoed from the database.
            */}
            <p className={styles.consolationLead}>{dict.consolationLead}</p>
            {/* The heading above already names the bracket; see the helper. */}
            <Bracket rounds={withoutConsolationPrefix(draw.consolation.rounds)} dict={dict} />
          </section>
        )}

        <SiteFooter />
      </section>
    </main>
  );
}
