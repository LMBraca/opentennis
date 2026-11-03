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
import Link from 'next/link';
import { listDraws, loadDraw } from '@/lib/queries';
import { Bracket } from '@/components/bracket';
import { RoundRobinView } from '@/components/round-robin-view';
import { DrawSwitcher } from '@/components/draw-switcher';
import { CategoryChip, DisciplineChip } from '@/components/category-chip';
import styles from './draw.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string; category: string; discipline: string }>;
}

function parseDiscipline(value: string): 'singles' | 'doubles' | null {
  return value === 'singles' || value === 'doubles' ? value : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, category, discipline } = await params;
  const d = parseDiscipline(discipline);
  if (d === null) return { title: 'Draw' };
  const draw = await loadDraw(slug, category, d);
  if (draw === null) return { title: 'Draw' };
  const label = `${draw.category.code} ${d === 'singles' ? 'Singles' : 'Doubles'}`;
  return { title: `${label} · ${draw.tournament.name}` };
}

export default async function DrawPage({ params }: Params) {
  const { slug, category, discipline } = await params;

  const parsed = parseDiscipline(discipline);
  if (parsed === null) notFound();

  const draw = await loadDraw(slug, category, parsed);
  if (draw === null) notFound();

  const draws = await listDraws(draw.tournament.id);
  const isRoundRobin = draw.stage?.kind === 'roundRobin';
  const matchCount = draw.rounds.reduce((n, r) => n + r.matches.length, 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href={`/t/${slug}`} className={styles.back}>
          ← {draw.tournament.name}
        </Link>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            {draw.category.code} {parsed === 'singles' ? 'Singles' : 'Doubles'}
          </h1>
          <div className={styles.chips}>
            <CategoryChip code={draw.category.code} rank={draw.category.rank} showTicks />
            <DisciplineChip discipline={parsed} />
          </div>
        </div>

        {/* The engine's own words, so an organizer can see why the draw looks
            the way it does -- seeded placement or a dice roll. */}
        {draw.stage?.description != null && draw.stage.description !== '' && (
          <p className={styles.description}>{draw.stage.description}</p>
        )}

        <p className={styles.stats}>
          {draw.entrantCount} entrants · {matchCount} {matchCount === 1 ? 'match' : 'matches'}
        </p>
      </header>

      <DrawSwitcher
        tournamentSlug={slug}
        draws={draws}
        activeCategorySlug={category}
        activeDiscipline={parsed}
      />

      <section className={styles.body}>
        {draw.stage === null ? (
          <p className={styles.empty}>This draw has not been generated yet.</p>
        ) : isRoundRobin ? (
          <RoundRobinView rounds={draw.rounds} />
        ) : (
          <Bracket rounds={draw.rounds} />
        )}
      </section>
    </main>
  );
}
