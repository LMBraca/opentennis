/**
 * Round robin view: matches grouped by round.
 *
 * Standings are deliberately NOT computed here. The engine's tiebreaker
 * cascade needs completed results, and until a match has a score the table
 * would be every entrant tied at zero -- which tells a reader nothing and
 * invites the cascade to resolve ties by drawing lots on an empty group.
 * Standings land with SCR (scoring), alongside the tiebreaker trace.
 */

import type { ReactNode } from 'react';
import type { DrawMatch, DrawRound } from '@/lib/queries';
import { MatchNode, type MatchNodeSide } from './match-node';
import styles from './round-robin-view.module.css';
import { matchNodeLabels, sourceText } from '@/lib/draw-text';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import { roundLabel } from '@/lib/draw-text';

function toNodeSides(
  match: DrawMatch,
  dict: Dictionary,
): readonly [MatchNodeSide, MatchNodeSide] {
  const build = (position: 0 | 1): MatchNodeSide => {
    const side = match.sides.find((s) => s.position === position);
    const scores = match.sets.map((s) => (position === 0 ? s.side0Games : s.side1Games));
    return {
      name: side?.name ?? null,
      seed: side?.seed ?? null,
      sourceLabel: sourceText(side?.source ?? null, dict),
      scores: scores.length > 0 ? scores : undefined,
      isWinner: match.winnerEntrantId !== null && side?.entrantId === match.winnerEntrantId,
    };
  };
  return [build(0), build(1)];
}

export function RoundRobinView({
  rounds,
  dict,
}: {
  readonly rounds: readonly DrawRound[];
  readonly dict: Dictionary;
}): ReactNode {
  if (rounds.length === 0) {
    return <p className={styles.empty}>{dict.notGenerated}</p>;
  }

  return (
    <div className={styles.rounds}>
      {rounds.map((round) => (
        <section key={round.id} className={styles.round}>
          <h3 className={styles.head}>
            {roundLabel(round.name, dict)}
            <span className={styles.count}>
              {round.matches.length === 1
                ? dict.matchCount1
                : fill(dict.matchCountN, { n: String(round.matches.length) })}
            </span>
          </h3>
          <div className={styles.matches}>
            {round.matches.map((m) => (
              <MatchNode
                key={m.id}
                sides={toNodeSides(m, dict)}
                labels={matchNodeLabels(dict)}
                status={m.status as 'pending' | 'bye' | 'live' | 'complete'}
                setColumns={3}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
