'use client';

/**
 * PUB-3b — zoom for a draw too big to read at once.
 *
 * A 32-draw is 1700px wide and taller than any screen, so it needs to be
 * readable at less than 1:1.
 *
 * A thin wrapper around the EXISTING scroll container rather than a new
 * renderer: it sets a CSS zoom scale on the canvas. The bracket itself is
 * untouched, so it keeps working with JavaScript off and keeps its keyboard
 * navigation (PUB-12) at every zoom level.
 *
 * It had a minimap beside the zoom level — dots for each match with a
 * viewport rectangle, click to jump. It went because it did not read as
 * interactive: a div rather than a button, aria-hidden so no keyboard or
 * screen-reader user could reach it at all, and small enough that the one
 * thing it offered over plain scrolling was not apparent. A control nobody
 * can tell is a control is decoration with a click handler.
 *
 * Only mounts for draws big enough to need it. A quarterfinal bracket fits
 * on a laptop and a zoom control on top of it is clutter.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './bracket-zoom.module.css';

const LEVELS = [0.5, 0.75, 1] as const;
/** Below this many first-round matches the bracket fits; no controls. */
const MIN_MATCHES = 8;

export function BracketZoom({
  width,
  height,
  firstRoundMatches,
  labels,
  scope,
}: {
  readonly width: number;
  readonly height: number;
  readonly firstRoundMatches: number;
  readonly labels: { readonly zoomIn: string; readonly zoomOut: string };
  /** Which bracket this controls. See the note in bracket.tsx. */
  readonly scope: string;
}) {
  const [zoom, setZoom] = useState(1);
  const scrollerRef = useRef<HTMLElement | null>(null);

  // The scroll container is rendered by the server component next door, so
  // it is found rather than owned. Looking it up by data attribute keeps the
  // two from having to share a ref across the server boundary.
  //
  // The scope VALUE is not optional. Unscoped, this returned the first
  // bracket in the document, so on a page with a consolation draw the
  // second controller drove the first bracket.
  useEffect(() => {
    scrollerRef.current = document.querySelector<HTMLElement>(
      `[data-bracket-scroll="${CSS.escape(scope)}"]`,
    );
  }, [scope]);

  // Zoom is applied to the canvas rather than the scroller, so scrollWidth
  // tracks it and the scrollbar stays proportional to the zoomed bracket.
  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>(
      `[data-bracket-canvas="${CSS.escape(scope)}"]`,
    );
    if (canvas === null) return;
    canvas.style.transform = `scale(${zoom})`;
    canvas.style.transformOrigin = 'top left';
    canvas.style.width = `${width * zoom}px`;
    canvas.style.height = `${height * zoom}px`;
  }, [zoom, width, height, scope]);

  if (firstRoundMatches < MIN_MATCHES) return null;


  return (
    <div className={styles.bar}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setZoom(LEVELS[Math.max(0, LEVELS.indexOf(zoom as 0.5) - 1)] ?? 0.5)}
          aria-label={labels.zoomOut}
        >
          −
        </button>
        <span className={styles.level}>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            setZoom(LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(zoom as 0.5) + 1)] ?? 1)
          }
          aria-label={labels.zoomIn}
        >
          +
        </button>
      </div>

    </div>
  );
}
