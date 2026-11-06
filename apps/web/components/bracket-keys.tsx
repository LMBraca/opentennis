'use client';

/**
 * Keyboard navigation for the bracket (PUB-12).
 *
 * The bracket is the centrepiece of the public site and, until now, no part
 * of it could be reached without a mouse: the nodes carried good
 * aria-labels and nothing was focusable, so a keyboard user could scroll
 * the canvas and never land on a match.
 *
 * ONE TAB STOP, then arrows. Thirty-one tab stops to cross a 32-draw is not
 * navigation, it is a trap — so this uses a roving tabindex, the same
 * pattern a grid or a tree uses. Tab puts you on the bracket, arrows move
 * within it, Tab again leaves.
 *
 * The mapping follows what the draw looks like rather than the DOM order:
 * left and right move between ROUNDS, up and down between matches in the
 * same round. That is how a person reads a bracket out loud, so it is how
 * the keys should work.
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import styles from './bracket-keys.module.css';

export interface NodeAddress {
  readonly matchId: string;
  readonly roundIndex: number;
  readonly slotIndex: number;
}

/**
 * A thin client wrapper so the bracket itself can stay server-rendered.
 * It only needs the addresses, not the markup: the nodes are found by
 * `[data-match-id]` at runtime.
 */
export function BracketKeys({
  nodes,
  label,
  children,
}: {
  readonly nodes: readonly NodeAddress[];
  readonly label: string;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<string | null>(nodes[0]?.matchId ?? null);

  const focusNode = useCallback((matchId: string) => {
    const container = ref.current;
    if (container === null) return;
    const el = container.querySelector<HTMLElement>(`[data-match-id="${CSS.escape(matchId)}"]`);
    if (el === null) return;

    // Roving tabindex: exactly one node is tabbable at a time, so leaving
    // the bracket takes one Tab rather than one per match.
    for (const other of container.querySelectorAll<HTMLElement>('[data-match-id]')) {
      other.tabIndex = other === el ? 0 : -1;
    }
    activeRef.current = matchId;
    el.focus();
    // The canvas scrolls horizontally; focus that lands off-screen is focus
    // the user cannot see.
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  useEffect(() => {
    const container = ref.current;
    if (container === null) return;
    const all = container.querySelectorAll<HTMLElement>('[data-match-id]');
    all.forEach((el, i) => {
      el.tabIndex = i === 0 ? 0 : -1;
    });
  }, [nodes]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-match-id]');
      if (target === null) return;

      const current = nodes.find((n) => n.matchId === target.dataset['matchId']);
      if (current === undefined) return;

      const inRound = (round: number) =>
        nodes.filter((n) => n.roundIndex === round).sort((a, b) => a.slotIndex - b.slotIndex);

      let next: NodeAddress | undefined;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown': {
          const column = inRound(current.roundIndex);
          const at = column.findIndex((n) => n.matchId === current.matchId);
          next = column[at + (event.key === 'ArrowDown' ? 1 : -1)];
          break;
        }
        case 'ArrowRight':
        case 'ArrowLeft': {
          const delta = event.key === 'ArrowRight' ? 1 : -1;
          const column = inRound(current.roundIndex + delta);
          if (column.length === 0) break;
          /*
           * Each round has half as many matches as the one before, so a
           * straight index carry-over would drift. Proportional position
           * keeps you roughly where you were on the page, which is what
           * "move one round across" means when looking at a bracket.
           */
          const here = inRound(current.roundIndex);
          const at = here.findIndex((n) => n.matchId === current.matchId);
          const ratio = here.length <= 1 ? 0 : at / (here.length - 1);
          next = column[Math.round(ratio * (column.length - 1))];
          break;
        }
        case 'Home':
          next = nodes.find((n) => n.roundIndex === current.roundIndex);
          break;
        case 'End': {
          const column = inRound(current.roundIndex);
          next = column[column.length - 1];
          break;
        }
        default:
          return;
      }

      if (next === undefined) return;
      event.preventDefault();
      focusNode(next.matchId);
    },
    [nodes, focusNode],
  );

  return (
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={label}
      className={styles.keys}
    >
      {children}
    </div>
  );
}
