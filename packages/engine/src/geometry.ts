/**
 * Bracket layout: deterministic coordinates for every match node and the
 * connector paths between them.
 *
 * Spec: docs/tournament-formats.md §2.7.
 *
 * Pure arithmetic — no DOM, no SVG library, no measurement. The renderer gets
 * numbers and path strings and draws them. Keeping layout here rather than in
 * the component means the same geometry drives the interactive bracket, the
 * printable draw sheet, and the share-card image.
 */

import { engineError } from './errors.js';
import type { GeneratedStage } from './types.js';

export interface GeometryOptions {
  readonly nodeWidth: number;
  readonly nodeHeight: number;
  /** Vertical space between adjacent first-round nodes. */
  readonly verticalGap: number;
  /** Horizontal space between round columns. Connectors live in here. */
  readonly columnGap: number;
}

/** Multiples of 8, matching the design system's spacing rhythm. */
export const DEFAULT_GEOMETRY: GeometryOptions = {
  nodeWidth: 240,
  nodeHeight: 64,
  verticalGap: 8,
  columnGap: 56,
};

export interface LaidOutNode {
  readonly matchId: string;
  readonly roundIndex: number;
  readonly slotIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Vertical centre — where connectors attach. */
  readonly centerY: number;
}

export interface Connector {
  readonly id: string;
  readonly fromMatchId: string;
  readonly toMatchId: string;
  /** SVG path data: out of the child, across, then into the parent. */
  readonly d: string;
  /**
   * Exact path length. Orthogonal segments mean this is computable rather than
   * measured, which matters because the Advance Line animation drives
   * stroke-dashoffset and would otherwise need a getTotalLength() call per
   * path on every mount.
   */
  readonly length: number;
}

export interface BracketLayout {
  readonly nodes: readonly LaidOutNode[];
  readonly connectors: readonly Connector[];
  readonly width: number;
  readonly height: number;
  readonly options: GeometryOptions;
}

/** Vertical distance between nodes in round r. Doubles each round. */
export function pitchFor(roundIndex: number, options: GeometryOptions): number {
  return (options.nodeHeight + options.verticalGap) * 2 ** roundIndex;
}

export function xFor(roundIndex: number, options: GeometryOptions): number {
  return roundIndex * (options.nodeWidth + options.columnGap);
}

export function yFor(roundIndex: number, slotIndex: number, options: GeometryOptions): number {
  const pitch = pitchFor(roundIndex, options);
  return pitch * slotIndex + (pitch - options.nodeHeight) / 2;
}

function validate(stage: GeneratedStage, options: GeometryOptions): void {
  if (stage.kind !== 'singleElimination') {
    // A round robin has no bracket to lay out. Failing loudly beats returning
    // a plausible-looking layout that means nothing.
    throw engineError('WRONG_STAGE_KIND', `Cannot lay out a "${stage.kind}" stage as a bracket`, {
      kind: stage.kind,
    });
  }

  for (const [key, value] of Object.entries(options)) {
    if (!Number.isFinite(value) || value < 0) {
      throw engineError('INVALID_GEOMETRY', `Geometry option "${key}" must be >= 0`, {
        [key]: value,
      });
    }
  }
  if (options.nodeWidth <= 0 || options.nodeHeight <= 0) {
    throw engineError('INVALID_GEOMETRY', 'Node width and height must be positive', {
      ...options,
    });
  }
}

/**
 * Lay out a generated stage.
 *
 * Connectors are emitted **one per child**, each a three-segment path: out of
 * the child's right edge, across to the midpoint of the column gap, vertically
 * to the parent's centreline, then into the parent's left edge. Two siblings
 * therefore overlap on the final horizontal stub, which is invisible at the
 * same stroke colour and buys something more valuable: the Advance Line
 * animation can draw exactly the completed match's path without touching its
 * sibling's.
 *
 * (An earlier revision of the spec called for one shared path per *pair*. That
 * is fewer nodes but makes per-child animation impossible, which is the whole
 * reason the connectors exist as individually addressable paths.)
 */
export function layoutBracket(
  stage: GeneratedStage,
  options: GeometryOptions = DEFAULT_GEOMETRY,
): BracketLayout {
  validate(stage, options);

  const mainRounds = stage.rounds.filter((r) => r.kind === 'main');
  const nodes: LaidOutNode[] = [];
  const connectors: Connector[] = [];

  for (const round of mainRounds) {
    for (const match of round.matches) {
      const y = yFor(round.index, match.slotIndex, options);
      nodes.push({
        matchId: match.id,
        roundIndex: round.index,
        slotIndex: match.slotIndex,
        x: xFor(round.index, options),
        y,
        width: options.nodeWidth,
        height: options.nodeHeight,
        centerY: y + options.nodeHeight / 2,
      });
    }
  }

  const firstRoundMatches = mainRounds[0]?.matches.length ?? 0;
  const width =
    mainRounds.length === 0
      ? 0
      : mainRounds.length * options.nodeWidth + (mainRounds.length - 1) * options.columnGap;
  let height = pitchFor(0, options) * firstRoundMatches;

  // Connectors follow the winnerOf references rather than being re-derived from
  // slot arithmetic, so the drawing can never disagree with the data.
  const nodeById = new Map(nodes.map((n) => [n.matchId, n]));

  for (const round of mainRounds) {
    for (const match of round.matches) {
      const parent = nodeById.get(match.id);
      if (parent === undefined) continue;

      for (const side of match.sides) {
        const ref = side.sourceRef;
        if (ref?.kind !== 'winnerOf') continue;
        const child = nodeById.get(ref.matchId);
        if (child === undefined) continue;

        const startX = child.x + child.width;
        const startY = child.centerY;
        const endX = parent.x;
        const endY = parent.centerY;
        const midX = startX + options.columnGap / 2;

        connectors.push({
          id: `${ref.matchId}->${match.id}`,
          fromMatchId: ref.matchId,
          toMatchId: match.id,
          d: `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`,
          length: options.columnGap + Math.abs(endY - startY),
        });
      }
    }
  }

  // The third-place playoff is detached from the elimination chain, so it gets
  // no connectors and sits beneath the final's column. A renderer that wants
  // dashed loser-lines back to the semifinals can derive them from sourceRef.
  const thirdPlace = stage.rounds.find((r) => r.kind === 'thirdPlace');
  const thirdPlaceMatch = thirdPlace?.matches[0];
  if (thirdPlace !== undefined && thirdPlaceMatch !== undefined) {
    const column = Math.max(0, mainRounds.length - 1);
    const y = height + options.verticalGap * 4;
    nodes.push({
      matchId: thirdPlaceMatch.id,
      roundIndex: thirdPlace.index,
      slotIndex: 0,
      x: xFor(column, options),
      y,
      width: options.nodeWidth,
      height: options.nodeHeight,
      centerY: y + options.nodeHeight / 2,
    });
    height = y + options.nodeHeight;
  }

  return { nodes, connectors, width, height, options };
}

/** Index a layout by match id, for hit-testing and shared-element transitions. */
export function nodeIndex(layout: BracketLayout): ReadonlyMap<string, LaidOutNode> {
  return new Map(layout.nodes.map((n) => [n.matchId, n]));
}
