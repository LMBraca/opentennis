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
import { matchNodeLabels, roundLabel, sourceText } from '@/lib/draw-text';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import { outcomeAbbreviation } from '@/lib/match-result';
import { MatchNode, type MatchNodeSide } from './match-node';
import { BracketKeys } from './bracket-keys';
import { BracketZoom } from './bracket-zoom';
import styles from './bracket.module.css';

export interface BracketProps {
  readonly rounds: readonly DrawRound[];
  /**
   * The reader's language. Required, not optional with an English default:
   * this site's default locale is Spanish, and an omitted dictionary would
   * silently ship English round names to the people the site is for.
   */
  readonly dict: Dictionary;
  /** Columns of score to reserve, so every node in the bracket aligns. */
  readonly setColumns?: number;
  /** PUB-3b control labels. Strings only — functions cannot cross to a client. */
  readonly zoomLabels?: {
    readonly zoomIn: string;
    readonly zoomOut: string;
    readonly overview: string;
  };
}

/** Winner-aware sides for the match node. */
function toNodeSides(
  match: DrawMatch,
  dict: Dictionary,
): readonly [MatchNodeSide, MatchNodeSide] {
  const build = (position: 0 | 1): MatchNodeSide => {
    const side = match.sides.find((s) => s.position === position);
    const scores = match.sets.map((s) => (position === 0 ? s.side0Games : s.side1Games));
    const tiebreaks = match.sets.map((s) =>
      position === 0 ? s.side0TiebreakPoints : s.side1TiebreakPoints,
    );
    return {
      name: side?.name ?? null,
      seed: side?.seed ?? null,
      sourceLabel: sourceText(side?.source ?? null, dict),
      scores: scores.length > 0 ? scores : undefined,
      tiebreaks: tiebreaks.length > 0 ? tiebreaks : undefined,
      isWinner:
        match.winnerEntrantId !== null && side?.entrantId === match.winnerEntrantId,
    };
  };
  return [build(0), build(1)];
}


export function Bracket({
  rounds,
  dict,
  setColumns = 3,
  zoomLabels = { zoomIn: dict.zoomIn, zoomOut: dict.zoomOut, overview: dict.drawKeyboardHint },
}: BracketProps): ReactNode {
  const main = mainRounds(rounds);
  const thirdPlace = thirdPlaceRound(rounds);

  if (main.length === 0) {
    return <p className={styles.empty}>This draw has not been generated yet.</p>;
  }

  const nodeLabels = matchNodeLabels(dict);

  const layout = bracketLayout(main);

  /*
   * A page can hold more than one bracket — a draw with a consolation shows
   * two — so the zoom control's hooks have to name WHICH bracket they
   * belong to. They were bare attributes, and `document.querySelector`
   * always returns the first match in the document: the consolation's zoom
   * controller resized the MAIN draw's canvas to the consolation's
   * dimensions, which clipped half the quarterfinals behind
   * `overflow: hidden`. It did it even while rendering nothing itself,
   * because an effect still runs in a component that returns null.
   *
   * The first match's database id is the scope key: unique across the page
   * by construction, and stable between renders.
   */
  const scope = main[0]?.matches[0]?.id ?? 'bracket';
  const matchByEngineId = new Map(
    main.flatMap((r) => r.matches.map((m) => [m.engineMatchId, { match: m, round: r }] as const)),
  );

  return (
    <>
      {/* ---- Full bracket, wide screens ---- */}
      <BracketKeys
        label={dict.drawKeyboardHint}
        nodes={layout.nodes.map((n) => ({
          matchId: n.matchId,
          roundIndex: n.roundIndex,
          slotIndex: n.slotIndex,
        }))}
      >
      <div className={styles.wide}>
        <BracketZoom
          nodes={layout.nodes.map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }))}
          width={layout.width}
          height={layout.height}
          firstRoundMatches={main[0]?.matches.length ?? 0}
          labels={zoomLabels}
          scope={scope}
        />
        {/* PUB-3b hooks on. The zoom control finds these by attribute
            rather than by ref, because it is a client component and this
            tree is server-rendered. The value scopes the lookup to this
            bracket; see `scope` above. */}
        <div className={styles.canvasScroll} data-bracket-scroll={scope}>
          {/* Column headers go ABOVE the columns they label, and INSIDE the
              scroll container so they track the bracket sideways. They used
              to sit underneath it, which reads as a footnote rather than a
              header. They must also stay inside .wide — that is display:none
              below 1024px, and a fixed-width label row outside it scrolled
              the whole page by 754px on a phone. */}
      <div className={styles.roundLabels} style={{ width: layout.width }}>
              {main.map((round, index) => (
                <div
                  key={round.id}
                  className={styles.roundLabel}
                  style={{
                    width: DEFAULT_GEOMETRY.nodeWidth,
                    marginRight: index < main.length - 1 ? DEFAULT_GEOMETRY.columnGap : 0,
                  }}
                >
                  {roundLabel(round.name, dict)}
                </div>
              ))}
            </div>
          <div
            className={styles.canvas}
            data-bracket-canvas={scope}
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
                    sides={toNodeSides(entry.match, dict)}
                    labels={nodeLabels}
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
              {roundLabel(round.name, dict)}
              <span className={styles.columnCount}>
                {round.matches.length === 1
                  ? dict.matchCount1
                  : fill(dict.matchCountN, { n: String(round.matches.length) })}
              </span>
            </h3>
            <div className={styles.columnMatches}>
              {round.matches.map((m) => (
                <MatchNode
                  key={m.id}
                  sides={toNodeSides(m, dict)}
                  labels={nodeLabels}
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
          <h3 className={styles.columnHead}>{roundLabel(thirdPlace.name, dict)}</h3>
          <div className={styles.thirdPlaceNode}>
            {thirdPlace.matches.map((m) => (
              <MatchNode
                key={m.id}
                sides={toNodeSides(m, dict)}
                labels={nodeLabels}
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
