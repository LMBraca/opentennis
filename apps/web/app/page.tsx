/**
 * Component gallery.
 *
 * Stands in for the real tournament landing page (PUB-1) and exists so the
 * design system can be seen and reviewed before any data layer is wired up.
 * Every value here is static sample data.
 */

import { CategoryGrid, type GridCell } from '@/components/category-grid';
import { CategoryChip, DisciplineChip } from '@/components/category-chip';
import { MatchNode } from '@/components/match-node';
import styles from './page.module.css';

const CATEGORIES = [
  { id: 'open', code: 'Open', slug: 'open', rank: 1 },
  { id: 'a', code: 'A', slug: 'a', rank: 2 },
  { id: 'b', code: 'B', slug: 'b', rank: 3 },
  { id: 'cplus', code: 'C+', slug: 'c-plus', rank: 4 },
  { id: 'c', code: 'C', slug: 'c', rank: 5 },
  { id: 'd', code: 'D', slug: 'd', rank: 6 },
];

const CELLS: GridCell[] = [
  { categoryId: 'open', discipline: 'singles', status: 'inProgress', format: 'roundRobin', entrantCount: 6, liveCount: 1, href: '#' },
  { categoryId: 'open', discipline: 'doubles', status: 'published', format: 'roundRobin', entrantCount: 4, href: '#' },
  { categoryId: 'a', discipline: 'singles', status: 'published', format: 'roundRobin', entrantCount: 8, href: '#' },
  { categoryId: 'a', discipline: 'doubles', status: 'published', format: 'roundRobin', entrantCount: 6, href: '#' },
  { categoryId: 'b', discipline: 'singles', status: 'inProgress', format: 'roundRobin', entrantCount: 10, liveCount: 2, href: '#' },
  { categoryId: 'b', discipline: 'doubles', status: 'notRun' },
  { categoryId: 'cplus', discipline: 'singles', status: 'inProgress', format: 'singleElimination', entrantCount: 32, liveCount: 3, href: '#' },
  { categoryId: 'cplus', discipline: 'doubles', status: 'published', format: 'singleElimination', entrantCount: 16, href: '#' },
  { categoryId: 'c', discipline: 'singles', status: 'published', format: 'singleElimination', entrantCount: 48, href: '#' },
  { categoryId: 'c', discipline: 'doubles', status: 'published', format: 'singleElimination', entrantCount: 24, href: '#' },
  { categoryId: 'd', discipline: 'singles', status: 'published', format: 'singleElimination', entrantCount: 64, href: '#' },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className="ot-label">Riverside Tennis Club · 14–16 November</p>
        <h1 className={styles.title}>Riverside Autumn Open</h1>
        <p className={styles.lede}>
          11 draws across 6 categories. 6 matches live now.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Draws</h2>
        <CategoryGrid categories={CATEGORIES} cells={CELLS} mode="public" showNotRun />
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
          {CATEGORIES.map((c) => (
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
