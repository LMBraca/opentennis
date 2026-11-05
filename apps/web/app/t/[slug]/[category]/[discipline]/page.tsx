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
  const d = parseDiscipline(discipline);
  if (d === null) return { title: 'Draw' };
  const draw = await loadDraw(slug, category, d.discipline, d.division);
  if (draw === null) return { title: 'Draw' };
  const label = drawLabel(draw.category.code, d.division, d.discipline, {
    divisionOpen: 'Open',
    divisionMens: "Men's",
    divisionWomens: "Women's",
    singles: 'Singles',
    doubles: 'Doubles',
  });
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
  const matchCount = draw.rounds.reduce((n, r) => n + r.matches.length, 0);

  return (
    <main className={styles.page}>
      <PageHeader
        width="wide"
        back={{ href: `/t/${slug}`, label: draw.tournament.name }}
        title={drawLabel(draw.category.code, parsed.division, parsed.discipline, dict)}
        {...(draw.stage?.description != null && draw.stage.description !== ''
          ? { lead: draw.stage.description }
          : {})}
        facts={[
          { value: draw.entrantCount, label: dict.entrants },
          { value: matchCount, label: matchCount === 1 ? dict.match : dict.matches },
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

      <section className={styles.body}>
        {draw.stage === null ? (
          <p className={styles.empty}>{dict.notGenerated}</p>
        ) : isRoundRobin ? (
          <RoundRobinView rounds={draw.rounds} />
        ) : (
          <Bracket rounds={draw.rounds} />
        )}
        <SiteFooter />
      </section>
    </main>
  );
}
