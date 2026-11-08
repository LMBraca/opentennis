/**
 * Component gallery at /style-guide.
 *
 * Stands in for the real tournament landing page (PUB-1). The CATEGORIES come
 * from Postgres; the cells are still sample data, since no tournament exists
 * yet. That is enough to prove the database path end to end in a real render
 * rather than only in a health check.
 *
 * NOT PUBLIC (OT-29). It was reachable on www.opentennis.mx, where the sample
 * cells read as a real tournament — live match, published draws, entrant
 * counts — to anyone who guessed the URL. Gated to preview and local, which is
 * where it is actually used; the gallery is for us, not for visitors.
 */

import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { CategoryGrid, type GridCell } from '@/components/category-grid';
import { CategoryChip, DisciplineChip } from '@/components/category-chip';
import { MatchNode } from '@/components/match-node';
import styles from './page.module.css';

// Read live so the page proves the database path on every request.
export const dynamic = 'force-dynamic';

const SAMPLE_CELLS: Array<Omit<GridCell, 'categoryId'> & { categorySlug: string }> = [
  { categorySlug: 'open', discipline: 'singles', status: 'inProgress', format: 'roundRobin', entrantCount: 6, liveCount: 1, href: '#' },
  { categorySlug: 'open', discipline: 'doubles', status: 'published', format: 'roundRobin', entrantCount: 4, href: '#' },
  { categorySlug: 'a', discipline: 'singles', status: 'published', format: 'roundRobin', entrantCount: 8, href: '#' },
  { categorySlug: 'a', discipline: 'doubles', status: 'published', format: 'roundRobin', entrantCount: 6, href: '#' },
  { categorySlug: 'b', discipline: 'singles', status: 'inProgress', format: 'roundRobin', entrantCount: 10, liveCount: 2, href: '#' },
  { categorySlug: 'b', discipline: 'doubles', status: 'notRun' },
  { categorySlug: 'c-plus', discipline: 'singles', status: 'inProgress', format: 'singleElimination', entrantCount: 32, liveCount: 3, href: '#' },
  { categorySlug: 'c-plus', discipline: 'doubles', status: 'published', format: 'singleElimination', entrantCount: 16, href: '#' },
  { categorySlug: 'c', discipline: 'singles', status: 'published', format: 'singleElimination', entrantCount: 48, href: '#' },
  { categorySlug: 'c', discipline: 'doubles', status: 'published', format: 'singleElimination', entrantCount: 24, href: '#' },
  { categorySlug: 'd', discipline: 'singles', status: 'published', format: 'singleElimination', entrantCount: 64, href: '#' },
];

export default async function Home() {
  // Checked inside the component, not in middleware or a redirect: a 404 is
  // the honest answer for a route that does not exist in production, and it
  // runs before the category read so production never queries for it.
  if (process.env['VERCEL_ENV'] === 'production') notFound();

  const categories = await db()
    .select({
      id: schema.categories.id,
      code: schema.categories.code,
      slug: schema.categories.slug,
      rank: schema.categories.rank,
    })
    .from(schema.categories)
    .where(eq(schema.categories.organizationId, orgId()))
    .orderBy(asc(schema.categories.rank));

  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const cells: GridCell[] = SAMPLE_CELLS.flatMap(({ categorySlug, ...rest }) => {
    const categoryId = idBySlug.get(categorySlug);
    return categoryId === undefined ? [] : [{ ...rest, categoryId }];
  });

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className="ot-label">Riverside Tennis Club, 14–16 November</p>
        <h1 className={styles.title}>Riverside Autumn Open</h1>
        <p className={styles.lede}>
          {cells.length} draws across {categories.length} categories, loaded from Neon.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Draws</h2>
        <CategoryGrid categories={categories} cells={cells} mode="public" showNotRun />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Match node</h2>
        <p className={styles.note}>
          The signature component. Fixed score columns so a bracket aligns
          vertically; seeds absent where a draw is unseeded.
        </p>

        <div className={styles.nodeRow}>
          <div className={styles.nodeCol}>
            <p className="ot-label">Complete, seeded</p>
            <MatchNode
              sides={[
                { name: 'Alvarez / Chen', seed: 1, scores: [6, 7, null], tiebreaks: [null, 4, null], isWinner: true },
                { name: 'Okonkwo / Reid', seed: 4, scores: [4, 6, null], tiebreaks: [null, 2, null] },
              ]}
              status="complete"
              courtLabel="Court 3"
              timeLabel="14:30"
            />
          </div>

          <div className={styles.nodeCol}>
            <p className="ot-label">Live — the only optic yellow</p>
            <MatchNode
              sides={[
                { name: 'Raman', scores: [6, 3, null] },
                { name: 'Lindqvist', scores: [4, 5, null] },
              ]}
              status="live"
              courtLabel="Court 1"
            />
          </div>

          <div className={styles.nodeCol}>
            <p className="ot-label">Undecided — never an empty box</p>
            <MatchNode
              sides={[
                { name: null, sourceLabel: 'Winner of QF2' },
                { name: null, sourceLabel: 'Winner of QF3' },
              ]}
            />
          </div>

          <div className={styles.nodeCol}>
            <p className="ot-label">Retirement, unseeded draw</p>
            <MatchNode
              sides={[
                { name: 'Moreau', scores: [6, 3, null], isWinner: true },
                { name: 'Tanaka', scores: [4, 2, null] },
              ]}
              status="complete"
              outcomeLabel="RET"
            />
          </div>

          <div className={styles.nodeCol}>
            <p className="ot-label">Bye — labelled, not blank</p>
            <MatchNode
              sides={[
                { name: 'Haddad', seed: 1, isWinner: true },
                { name: null, sourceLabel: 'Bye' },
              ]}
              status="bye"
            />
          </div>

          <div className={styles.nodeCol}>
            <p className="ot-label">Long name — wraps, never truncates</p>
            <MatchNode
              sides={[
                { name: 'Vandenberg-Oyelaran / Papadopoulos', scores: [7, null, null], tiebreaks: [5, null, null], isWinner: true },
                { name: 'Costa', scores: [6, null, null], tiebreaks: [7, null, null] },
              ]}
              status="complete"
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Category chips</h2>
        <p className={styles.note}>
          Never colour-coded. Six categories would invite six hues and wreck the
          one-accent rule, so position is shown with rank ticks instead.
        </p>
        <div className={styles.chipRow}>
          {categories.map((c) => (
            <CategoryChip key={c.id} code={c.code} rank={c.rank} showTicks />
          ))}
        </div>
        <div className={styles.chipRow}>
          <CategoryChip code="C+" rank={4} />
          <DisciplineChip discipline="doubles" />
          <span className={styles.note}>
            Two independent dimensions, two independent chips.
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Type</h2>
        <div className={styles.typeRow}>
          <span className={styles.specimenScore}>6 7 6</span>
          <span className="ot-label">Display, condensed, tabular</span>
        </div>
        <div className={styles.typeRow}>
          <span className={styles.specimenTitle}>Quarterfinal</span>
          <span className="ot-label">Display, expanded</span>
        </div>
      </section>
    </main>
  );
}
