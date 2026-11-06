/**
 * PUB-3: the bracket renderer.
 *
 * Takes a STAGE, not an event (docs/consolation-draws-deferred.md §4). A
 * consolation draw is a second stage of the same event, so a renderer written
 * against events would need rewriting to support it; one written against
 * stages is a second invocation plus a tab.
 *
 * Geometry comes from the engine's layoutBracket(), so the same coordinates
 * drive this view, the printable draw sheet, and the share-card image. The
 * engine also returns each connector's exact path length, which lets the
 * Advance Line animation set stroke-dasharray without a getTotalLength() call
 * per path on mount.
 *
 * Two layouts, both always in the DOM and swapped by media query so there is
 * no layout shift after first paint:
 *   - Full bracket (≥1024px): SVG connectors, absolutely positioned nodes.
 *   - Round column (<1024px): one round per screen, horizontal snap-scroll.
 */

import type { ReactNode } from 'react';
import { DEFAULT_GEOMETRY } from '@opentennis/engine';
import type { DrawMatch, DrawRound } from '@/lib/queries';
import { bracketLayout, mainRounds, thirdPlaceRound } from '@/lib/bracket-layout';
import { outcomeAbbreviation } from '@/lib/match-result';
import { MatchNode, type MatchNodeSide } from './match-node';
import { BracketKeys } from './bracket-keys';
import styles from './bracket.module.css';

export interface BracketProps {
  readonly rounds: readonly DrawRound[];
  /** Columns of score to reserve, so every node in the bracket aligns. */
  readonly setColumns?: number;
}

/** Winner-aware sides for the match node. */
function toNodeSides(match: DrawMatch): readonly [MatchNodeSide, MatchNodeSide] {
  const build = (position: 0 | 1): MatchNodeSide => {
    const side = match.sides.find((s) => s.position === position);
    const scores = match.sets.map((s) => (position === 0 ? s.side0Games : s.side1Games));
    const tiebreaks = match.sets.map((s) =>
      position === 0 ? s.side0TiebreakPoints : s.side1TiebreakPoints,
    );
    return {
      name: side?.name ?? null,
      seed: side?.seed ?? null,
      sourceLabel: side?.sourceLabel ?? null,
      scores: scores.length > 0 ? scores : undefined,
      tiebreaks: tiebreaks.length > 0 ? tiebreaks : undefined,
      isWinner:
        match.winnerEntrantId !== null && side?.entrantId === match.winnerEntrantId,
    };
  };
  return [build(0), build(1)];
}


export function Bracket({ rounds, setColumns = 3 }: BracketProps): ReactNode {
  const main = mainRounds(rounds);
  const thirdPlace = thirdPlaceRound(rounds);

  if (main.length === 0) {
    return <p className={styles.empty}>This draw has not been generated yet.</p>;
  }

  const layout = bracketLayout(main);
  const matchByEngineId = new Map(
    main.flatMap((r) => r.matches.map((m) => [m.engineMatchId, { match: m, round: r }] as const)),
  );

  return (
    <>
      {/* ---- Full bracket, wide screens ---- */}
      <BracketKeys
        label="Draw. Use the arrow keys to move between matches."
        nodes={layout.nodes.map((n) => ({
          matchId: n.matchId,
          roundIndex: n.roundIndex,
          slotIndex: n.slotIndex,
        }))}
      >
      <div className={styles.wide}>
        <div className={styles.canvasScroll}>
          {/* Column headers go ABOVE the columns they label, and INSIDE the
              scroll container so they track the bracket sideways. They used
              to sit underneath it, which reads as a footnote rather than a
              header. They must also stay inside .wide — that is display:none
              below 1024px, and a fixed-width label row outside it scrolled
              the whole page by 754px on a phone. */}
      <div className={styles.roundLabels} style={{ width: layout.width }}>
              {main.map((round) => (
                <div
                  key={round.id}
                  className={styles.roundLabel}
                  style={{ width: DEFAULT_GEOMETRY.nodeWidth, marginRight: DEFAULT_GEOMETRY.columnGap }}
                >
                  {round.name}
                </div>
              ))}
            </div>
          <div
            className={styles.canvas}
            style={{ width: layout.width, height: layout.height }}
          >
            <svg
              className={styles.connectors}
              width={layout.width}
              height={layout.height}
              aria-hidden="true"
            >
              {layout.connectors.map((c) => (
                <path
                  key={c.id}
                  d={c.d}
                  className={styles.connector}
                  // Exact length from the engine, ready for the Advance Line
                  // animation to drive stroke-dashoffset.
                  data-length={c.length}
                />
              ))}
            </svg>

            {layout.nodes.map((node) => {
              const entry = matchByEngineId.get(node.matchId);
              if (entry === undefined) return null;
              return (
                <div
                  key={node.matchId}
                  className={styles.node}
                  style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                >
                  <MatchNode
                    /* PUB-12: the focus target is the element that carries
                       the aria-label, so landing on it reads the match out
                       as one sentence. Roving tabindex set on the client. */
                    data-match-id={node.matchId}
                    data-round={node.roundIndex}
                    data-slot={node.slotIndex}
                    tabIndex={-1}
                    sides={toNodeSides(entry.match)}
                    status={entry.match.status as 'pending' | 'bye' | 'live' | 'complete'}
                    outcomeLabel={outcomeAbbreviation(entry.match.outcome)}
                    setColumns={setColumns}
                  />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      </BracketKeys>

      {/* ---- Round columns, phone. One round per screen, snap-scrolled. ---- */}
      <div className={styles.narrow}>
        {main.map((round) => (
          <section key={round.id} className={styles.column}>
            <h3 className={styles.columnHead}>
              {round.name}
              <span className={styles.columnCount}>
                {round.matches.length} {round.matches.length === 1 ? 'match' : 'matches'}
              </span>
            </h3>
            <div className={styles.columnMatches}>
              {round.matches.map((m) => (
                <MatchNode
                  key={m.id}
                  sides={toNodeSides(m)}
                  status={m.status as 'pending' | 'bye' | 'live' | 'complete'}
                  outcomeLabel={outcomeAbbreviation(m.outcome)}
                  setColumns={setColumns}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {thirdPlace !== undefined && thirdPlace.matches.length > 0 && (
        <section className={styles.thirdPlace}>
          <h3 className={styles.columnHead}>{thirdPlace.name}</h3>
          <div className={styles.thirdPlaceNode}>
            {thirdPlace.matches.map((m) => (
              <MatchNode
                key={m.id}
                sides={toNodeSides(m)}
                status={m.status as 'pending' | 'bye' | 'live' | 'complete'}
                outcomeLabel={outcomeAbbreviation(m.outcome)}
                setColumns={setColumns}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
