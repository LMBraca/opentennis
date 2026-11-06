/**
 * DES-4: the match node. The design system's signature component.
 *
 * Appears in brackets, schedules, result lists, and the review queue, so it
 * has to work at 240px in a bracket column and full-width on a phone.
 *
 * ┌─────────────────────────────────────┐
 * │▌¹ Alvarez / Chen           6  7  –  │  winner: ink-900, clay left rule
 * │  ⁴ Okonkwo / Reid          4  6  –  │  loser:  ink-500
 * └─────────────────────────────────────┘
 *
 * Three things it must get right (docs/design-system.md §4):
 *
 *   - Score columns are FIXED WIDTH so every node in a bracket aligns
 *     vertically. Columns, not inline text.
 *   - Seeds are OFTEN ABSENT, because most draws are unseeded. The node must
 *     look deliberate with no superscript rather than like something failed to
 *     load, so no space is reserved for a missing seed.
 *   - Names are NEVER truncated mid-surname. They shrink to 13px and then
 *     wrap to two lines. "Vandenberg…" is worse than a taller node.
 */

import type { CSSProperties, ReactNode } from 'react';
import styles from './match-node.module.css';

export type SideState = 'winner' | 'loser' | 'undecided' | 'live';

export interface MatchNodeSide {
  /** Display name. "Alvarez" or "Alvarez / Chen" for doubles. */
  readonly name: string | null;
  /** Rendered as a superscript. Null for the common unseeded case. */
  readonly seed?: number | null | undefined;
  /** Games per set. A dash renders for sets not played. */
  readonly scores?: readonly (number | null)[] | undefined;
  /** Tiebreak points, shown as a smaller superscript on the set score. */
  readonly tiebreaks?: readonly (number | null)[] | undefined;
  /**
   * What this side is waiting on, when undecided: "Winner of QF2",
   * "Group 2 · 1st". Never leave an empty box — an unexplained blank is the
   * most common cause of organizer distrust.
   */
  readonly sourceLabel?: string | null | undefined;
  readonly isWinner?: boolean | undefined;
}

export interface MatchNodeProps extends Pick<
  React.HTMLAttributes<HTMLElement>,
  'tabIndex' | 'role'
> {
  /** Data attributes the bracket uses to address this node by keyboard. */
  readonly ['data-match-id']?: string;
  readonly ['data-round']?: number;
  readonly ['data-slot']?: number;
  readonly sides: readonly [MatchNodeSide, MatchNodeSide];
  readonly status?: 'pending' | 'bye' | 'live' | 'complete' | undefined;
  /** RET, W/O, DEF — rendered as a label-styled suffix. */
  readonly outcomeLabel?: string | null | undefined;
  /** Number of score columns to reserve. Keeps a bracket's columns aligned. */
  readonly setColumns?: number;
  readonly courtLabel?: string | null;
  readonly timeLabel?: string | null;
  readonly onSelect?: () => void;
  readonly style?: CSSProperties;
  readonly className?: string;
}

function SeedMark({ seed }: { readonly seed: number | null | undefined }): ReactNode {
  // No placeholder when unseeded: most draws have no seeds at all, and
  // reserving space for a missing one makes the node look broken.
  if (seed === null || seed === undefined) return null;
  return <sup className={styles.seed}>{seed}</sup>;
}

function ScoreCells({
  side,
  columns,
}: {
  readonly side: MatchNodeSide;
  readonly columns: number;
}): ReactNode {
  const scores = side.scores ?? [];
  return (
    <>
      {Array.from({ length: columns }, (_, i) => {
        const value = scores[i];
        const tiebreak = side.tiebreaks?.[i];
        return (
          <span key={i} className={styles.scoreCell} aria-hidden={value == null}>
            {value == null ? (
              <span className={styles.scoreEmpty}>–</span>
            ) : (
              <>
                {value}
                {tiebreak != null && <sup className={styles.tiebreak}>{tiebreak}</sup>}
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

function Side({
  side,
  columns,
  status,
  outcomeLabel,
}: {
  readonly side: MatchNodeSide;
  readonly columns: number;
  readonly status: NonNullable<MatchNodeProps['status']>;
  readonly outcomeLabel: string | null | undefined;
}): ReactNode {
  const undecided = side.name === null;
  const state: SideState =
    status === 'live'
      ? 'live'
      : undecided
        ? 'undecided'
        : side.isWinner === true
          ? 'winner'
          : 'loser';

  return (
    <div className={styles.side} data-state={state}>
      <span className={styles.rule} aria-hidden="true" />
      <span className={styles.name}>
        {undecided ? (
          <span className={styles.source}>{side.sourceLabel ?? 'TBD'}</span>
        ) : (
          <>
            <SeedMark seed={side.seed} />
            {side.name}
            {outcomeLabel != null && side.isWinner !== true && (
              <span className={styles.outcome}>{outcomeLabel}</span>
            )}
          </>
        )}
      </span>
      <span className={styles.scores}>
        <ScoreCells side={side} columns={columns} />
      </span>
    </div>
  );
}

/**
 * Screen-reader sentence for the whole match, so a bracket is navigable
 * without sight: "Alvarez and Chen, seed 1, defeated Okonkwo and Reid, seed 4,
 * 6-4, 7-6." Assembled here rather than left to the DOM order, which would
 * read as a meaningless run of numbers.
 */
function describeMatch(
  sides: readonly [MatchNodeSide, MatchNodeSide],
  status: NonNullable<MatchNodeProps['status']>,
  outcomeLabel?: string | null,
): string {
  const describeSide = (s: MatchNodeSide): string => {
    if (s.name === null) return s.sourceLabel ?? 'to be decided';
    return s.seed == null ? s.name : `${s.name}, seed ${s.seed}`;
  };

  if (status === 'bye') {
    const present = sides.find((s) => s.name !== null);
    return `${present?.name ?? 'Entrant'} receives a bye`;
  }

  const [a, b] = sides;
  if (a.name === null || b.name === null) {
    return `${describeSide(a)} versus ${describeSide(b)}`;
  }

  const scoreLine = (a.scores ?? [])
    .map((value, i) => {
      const other = b.scores?.[i];
      return value == null || other == null ? null : `${value}-${other}`;
    })
    .filter((s): s is string => s !== null)
    .join(', ');

  const winner = sides.find((s) => s.isWinner === true);
  if (winner === undefined || status === 'live') {
    const prefix = status === 'live' ? 'Live: ' : '';
    return `${prefix}${describeSide(a)} versus ${describeSide(b)}${
      scoreLine === '' ? '' : `, ${scoreLine}`
    }`;
  }

  const loser = sides.find((s) => s !== winner) as MatchNodeSide;
  const verb = outcomeLabel == null ? 'defeated' : `beat (${outcomeLabel})`;
  return `${describeSide(winner)} ${verb} ${describeSide(loser)}${
    scoreLine === '' ? '' : `, ${scoreLine}`
  }`;
}

export function MatchNode({
  sides,
  status = 'pending',
  outcomeLabel,
  setColumns = 3,
  courtLabel,
  timeLabel,
  onSelect,
  style,
  className,
  ...rest
}: MatchNodeProps): ReactNode {
  const interactive = onSelect !== undefined;
  const Root = interactive ? 'button' : 'div';

  return (
    <Root
      className={[styles.node, className].filter(Boolean).join(' ')}
      data-status={status}
      style={style}
      {...(interactive
        ? { type: 'button' as const, onClick: onSelect }
        : {})}
      aria-label={describeMatch(sides, status, outcomeLabel)}
      /*
       * Pass-through so the bracket can make THIS element the keyboard
       * focus target. Focus has to land on the element that carries the
       * accessible name; a bare tabbable <div> wrapped around it has no
       * name of its own and screen readers announce it inconsistently.
       */
      {...rest}
    >
      {/* The visible rows are decorative: the aria-label above carries the
          whole match as one readable sentence. */}
      <div aria-hidden="true" className={styles.rows}>
        <Side side={sides[0]} columns={setColumns} status={status} outcomeLabel={outcomeLabel} />
        <Side side={sides[1]} columns={setColumns} status={status} outcomeLabel={outcomeLabel} />
      </div>
      {(courtLabel != null || timeLabel != null) && (
        <div aria-hidden="true" className={styles.meta}>
          {courtLabel != null && <span>{courtLabel}</span>}
          {timeLabel != null && <span>{timeLabel}</span>}
        </div>
      )}
    </Root>
  );
}
