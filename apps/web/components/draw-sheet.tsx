/**
 * OUT-1 — the printable draw sheet.
 *
 * This is the sheet that gets pinned to the clubhouse wall, so it is designed
 * for paper rather than reskinned for it:
 *
 *   - One SVG with a viewBox. A bracket is far wider than a page and the only
 *     honest way to fit an arbitrary draw size onto whatever paper the club
 *     loads is to scale a vector. Same reasoning as the QR codes: a drawing we
 *     can compute exactly should not be rasterised at one size and hoped over.
 *   - Every slot sits on a RULE, not inside a box, and the right-hand end of
 *     each rule is left clear. That is where a score gets written in pen while
 *     a match is still on court, which is most of what a wall sheet is for.
 *   - Later rounds print BLANK rather than "Winner of QF2". On screen that
 *     label tells you what you are waiting for; on paper the connector already
 *     says it, and the space is needed for a handwritten name.
 *
 * Why not just print the public draw page? Because the interactive bracket is
 * `display: none` under 1024px and A4 portrait is ~794 CSS px, so printing it
 * yields the phone layout — a horizontal snap-scroller, cropped to its first
 * round. A sheet the club actually hangs up needs its own renderer.
 *
 * Pure and presentational: it takes rows and pre-formatted strings, so it can
 * be rendered from an admin page, a public route or a test without reaching
 * for a request.
 */

import type { ReactNode } from 'react';
import type { GeometryOptions } from '@opentennis/engine';
import type { DrawMatch, DrawRound } from '@/lib/queries';
import { bracketLayout, mainRounds, thirdPlaceRound } from '@/lib/bracket-layout';
import { clipName, rowScore, sideGames } from '@/lib/draw-sheet-format';
import styles from './draw-sheet.module.css';

/**
 * Tighter than the on-screen geometry (240x64). These numbers are viewBox
 * units, not pixels — the sheet scales to the page — but their RATIO sets how
 * much of the page goes to names versus white space, and a wall sheet wants
 * more rows per page than a screen does.
 */
const SHEET_GEOMETRY: GeometryOptions = {
  nodeWidth: 200,
  nodeHeight: 40,
  verticalGap: 4,
  columnGap: 28,
};

/** Each match node is two stacked rows, one per side. */
const ROW_HEIGHT = SHEET_GEOMETRY.nodeHeight / 2;
/** Left strip holding the seed number, so names start on a common left edge. */
const SEED_GUTTER = 13;
/** Band above the bracket for the round names. */
const LABEL_BAND = 24;
/** Baseline sits this far above the rule the name rests on. */
const BASELINE_LIFT = 6;

export interface DrawSheetLabels {
  readonly bye: string;
  readonly wonLost: string;
  readonly notGenerated: string;
}

export interface DrawSheetProps {
  /** "C+ Singles" — already in the reader's language. */
  readonly title: string;
  readonly tournamentName: string;
  /** Venue, dates, entrant count. Rendered as separate items, never joined. */
  readonly meta: readonly string[];
  /** Stage kind. A round robin prints as boxes, anything else as a bracket. */
  readonly kind: string | null;
  readonly rounds: readonly DrawRound[];
  readonly groups: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly labels: DrawSheetLabels;
}

/* ---------------------------------------------------------------- bracket -- */

function BracketSheet({
  rounds,
  labels,
}: {
  readonly rounds: readonly DrawRound[];
  readonly labels: DrawSheetLabels;
}): ReactNode {
  const main = mainRounds(rounds);
  // SHEET_GEOMETRY, not the default: the node rows below are drawn against
  // these dimensions, so laying out on the on-screen 240x64 grid would put
  // every name a few units off the rule it is supposed to sit on.
  const layout = bracketLayout(main, SHEET_GEOMETRY);
  const thirdPlace = thirdPlaceRound(rounds);
  const thirdPlaceMatch = thirdPlace?.matches[0];

  const matchByEngineId = new Map(
    main.flatMap((r) => r.matches.map((m) => [m.engineMatchId, m] as const)),
  );

  /*
   * Round labels are positioned from the laid-out nodes rather than from a
   * parallel calculation. The on-screen bracket learned this the hard way: a
   * label row with its own widths drifts out of register with the columns it
   * names the moment either side changes.
   */
  const columnX = new Map<number, number>();
  for (const node of layout.nodes) {
    const current = columnX.get(node.roundIndex);
    if (current === undefined || node.x < current) columnX.set(node.roundIndex, node.x);
  }

  const thirdPlaceY = layout.height + SHEET_GEOMETRY.verticalGap * 6;
  const totalHeight =
    LABEL_BAND +
    (thirdPlaceMatch === undefined ? layout.height : thirdPlaceY + SHEET_GEOMETRY.nodeHeight + 14);

  const renderNode = (match: DrawMatch, x: number, y: number): ReactNode => {
    return (
      <g key={match.id} transform={`translate(${x} ${y})`}>
        {([0, 1] as const).map((position) => {
          const side = match.sides.find((s) => s.position === position);
          const ruleY = ROW_HEIGHT * (position + 1);
          const textY = ruleY - BASELINE_LIFT;
          const isWinner =
            match.winnerEntrantId !== null && side?.entrantId === match.winnerEntrantId;

          // A bye has no opponent to name. Everything else that is still
          // undecided prints blank — see the note at the top of the file.
          const name =
            side?.name ??
            (side?.source?.kind === 'bye' || match.status === 'bye' ? labels.bye : null);

          const score = rowScore(match, position);

          return (
            <g key={position}>
              <line
                className={styles.rule}
                x1={0}
                y1={ruleY}
                x2={SHEET_GEOMETRY.nodeWidth}
                y2={ruleY}
              />
              {side?.seed != null && (
                <text className={styles.seed} x={0} y={textY}>
                  {side.seed}
                </text>
              )}
              {name !== null && (
                <text
                  className={isWinner ? styles.nameWinner : styles.name}
                  x={SEED_GUTTER}
                  y={textY}
                >
                  {clipName(name)}
                </text>
              )}
              {score !== '' && (
                <text
                  className={styles.score}
                  x={SHEET_GEOMETRY.nodeWidth}
                  y={textY}
                  textAnchor="end"
                >
                  {score}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg
      className={styles.canvas}
      viewBox={`0 0 ${layout.width} ${totalHeight}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label="Draw sheet"
    >
      {main.map((round) => {
        const x = columnX.get(round.roundIndex);
        if (x === undefined) return null;
        return (
          <text key={round.id} className={styles.roundName} x={x} y={LABEL_BAND - 10}>
            {round.name}
          </text>
        );
      })}

      <g transform={`translate(0 ${LABEL_BAND})`}>
        {layout.connectors.map((connector) => (
          <path key={connector.id} className={styles.connector} d={connector.d} />
        ))}

        {layout.nodes.map((node) => {
          const match = matchByEngineId.get(node.matchId);
          if (match === undefined) return null;
          return renderNode(match, node.x, node.y);
        })}

        {/*
          The third-place playoff hangs off the losing semifinalists rather
          than feeding anything, so it gets no connector and sits under the
          final's column — the same placement the engine's own geometry uses.
        */}
        {thirdPlace !== undefined && thirdPlaceMatch !== undefined && (
          <>
            <text
              className={styles.roundName}
              x={layout.width - SHEET_GEOMETRY.nodeWidth}
              y={thirdPlaceY - 8}
            >
              {thirdPlace.name}
            </text>
            {renderNode(
              thirdPlaceMatch,
              layout.width - SHEET_GEOMETRY.nodeWidth,
              thirdPlaceY,
            )}
          </>
        )}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------ round robin -- */

interface Participant {
  readonly entrantId: string;
  readonly name: string;
  readonly seed: number | null;
}

/**
 * The classic round-robin box: everyone down the side, everyone across the
 * top, the diagonal struck out.
 *
 * A table rather than SVG, because this genuinely is a table — it scales by
 * font size and breaks across pages correctly, neither of which a drawing
 * does. Cells for matches already played are filled in; the rest are left
 * empty to be written in.
 */
function RoundRobinBox({
  name,
  rounds,
  labels,
}: {
  readonly name: string | null;
  readonly rounds: readonly DrawRound[];
  readonly labels: DrawSheetLabels;
}): ReactNode {
  const byId = new Map<string, Participant>();
  const scores = new Map<string, string>();

  for (const round of rounds) {
    for (const match of round.matches) {
      const side0 = match.sides.find((s) => s.position === 0);
      const side1 = match.sides.find((s) => s.position === 1);
      for (const side of [side0, side1]) {
        if (side?.entrantId != null && side.name !== null && !byId.has(side.entrantId)) {
          byId.set(side.entrantId, {
            entrantId: side.entrantId,
            name: side.name,
            seed: side.seed,
          });
        }
      }
      if (side0?.entrantId != null && side1?.entrantId != null) {
        const games0 = sideGames(match, 0);
        const games1 = sideGames(match, 1);
        if (games0 !== '') scores.set(`${side0.entrantId}:${side1.entrantId}`, games0);
        if (games1 !== '') scores.set(`${side1.entrantId}:${side0.entrantId}`, games1);
      }
    }
  }

  // Seeded players first, then alphabetical — the order a box is normally
  // drawn up in, and stable between reprints.
  const participants = [...byId.values()].sort((a, b) => {
    const seedA = a.seed ?? Number.POSITIVE_INFINITY;
    const seedB = b.seed ?? Number.POSITIVE_INFINITY;
    if (seedA !== seedB) return seedA - seedB;
    return a.name.localeCompare(b.name, 'es');
  });

  if (participants.length === 0) return null;

  return (
    <section className={styles.group}>
      {name !== null && <h3 className={styles.groupName}>{name}</h3>}
      <table className={styles.box}>
        <thead>
          <tr>
            {/* The corner of a crosstab names nothing: the row headers are
                the entrants and the column headers are the same people by
                number. Left empty rather than filled with a label. */}
            <th className={styles.boxCorner} scope="col" />

            {participants.map((p, index) => (
              <th key={p.entrantId} className={styles.boxHead} scope="col">
                {index + 1}
              </th>
            ))}
            <th className={styles.boxHead} scope="col">
              {labels.wonLost}
            </th>
          </tr>
        </thead>
        <tbody>
          {participants.map((row, rowIndex) => (
            <tr key={row.entrantId}>
              <th className={styles.boxName} scope="row">
                <span className={styles.boxIndex}>{rowIndex + 1}</span>
                {row.seed != null && <sup className={styles.seedMark}>{row.seed}</sup>}
                {row.name}
              </th>
              {participants.map((column, columnIndex) => (
                <td
                  key={column.entrantId}
                  className={styles.boxCell}
                  data-self={rowIndex === columnIndex ? 'true' : undefined}
                >
                  {rowIndex === columnIndex
                    ? ''
                    : (scores.get(`${row.entrantId}:${column.entrantId}`) ?? '')}
                </td>
              ))}
              <td className={styles.boxCell} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ------------------------------------------------------------------ sheet -- */

export function DrawSheet({
  title,
  tournamentName,
  meta,
  kind,
  rounds,
  groups,
  labels,
}: DrawSheetProps): ReactNode {
  const hasRounds = rounds.some((r) => r.matches.length > 0);

  return (
    <article className={styles.sheet}>
      {/*
        A <div>, NOT a <header>, and this is load-bearing. The print stylesheet
        in globals.css hides `body header` with !important to drop the site
        masthead from every printed page (DES-10). A <header> here is a
        descendant of body, so it matched that rule and the sheet printed with
        no tournament name, no category and no date — four unlabelled brackets
        on the clubhouse wall. It only shows up on paper, never on screen.
      */}
      <div className={styles.head}>
        <p className={styles.tournament}>{tournamentName}</p>
        <h2 className={styles.title}>{title}</h2>
        {meta.length > 0 && (
          <p className={styles.meta}>
            {/* Separate items with a gap. A " · " joined string is the
                template-chrome tell the design system bans. */}
            {meta.map((item) => (
              <span key={item} className={styles.metaItem}>
                {item}
              </span>
            ))}
          </p>
        )}
      </div>

      {!hasRounds ? (
        <p className={styles.empty}>{labels.notGenerated}</p>
      ) : kind === 'roundRobin' ? (
        <div className={styles.groups}>
          {groups.length === 0 ? (
            <RoundRobinBox name={null} rounds={rounds} labels={labels} />
          ) : (
            groups.map((group) => (
              <RoundRobinBox
                key={group.id}
                name={group.name}
                rounds={rounds.filter((r) => r.groupId === group.id)}
                labels={labels}
              />
            ))
          )}
        </div>
      ) : (
        <BracketSheet rounds={rounds} labels={labels} />
      )}
    </article>
  );
}
