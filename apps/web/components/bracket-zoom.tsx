'use client';

/**
 * PUB-3b — pan, zoom and a minimap for a draw too big to read at once.
 *
 * A 32-draw is 1700px wide and taller than any screen; the bracket already
 * scrolls, but scrolling alone loses you — you cannot tell where in the
 * draw you are, and finding the far semifinal means dragging blind.
 *
 * A thin wrapper around the EXISTING scroll container rather than a new
 * renderer: it sets a CSS zoom scale on the canvas and draws a minimap from
 * the node coordinates the server already computed. The bracket itself is
 * untouched, so it keeps working with JavaScript off and keeps its keyboard
 * navigation (PUB-12) at every zoom level.
 *
 * Only mounts for draws big enough to need it. A quarterfinal bracket fits
 * on a laptop and a zoom control on top of it is clutter.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './bracket-zoom.module.css';

const LEVELS = [0.5, 0.75, 1] as const;
/** Below this many first-round matches the bracket fits; no controls. */
const MIN_MATCHES = 8;

export interface MinimapNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function BracketZoom({
  nodes,
  width,
  height,
  firstRoundMatches,
  labels,
}: {
  readonly nodes: readonly MinimapNode[];
  readonly width: number;
  readonly height: number;
  readonly firstRoundMatches: number;
  readonly labels: { readonly zoomIn: string; readonly zoomOut: string; readonly overview: string };
}) {
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const scrollerRef = useRef<HTMLElement | null>(null);

  // The scroll container is rendered by the server component next door, so
  // it is found rather than owned. Looking it up by data attribute keeps the
  // two from having to share a ref across the server boundary.
  useEffect(() => {
    scrollerRef.current = document.querySelector<HTMLElement>('[data-bracket-scroll]');
  }, []);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (el === null) return;
    setView({ x: el.scrollLeft, y: el.scrollTop, w: el.clientWidth, h: el.clientHeight });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el === null) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  // Zoom is applied to the canvas, not the scroller, so scrollWidth tracks
  // it and the minimap's viewport rectangle stays honest.
  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>('[data-bracket-canvas]');
    if (canvas === null) return;
    canvas.style.transform = `scale(${zoom})`;
    canvas.style.transformOrigin = 'top left';
    canvas.style.width = `${width * zoom}px`;
    canvas.style.height = `${height * zoom}px`;
    sync();
  }, [zoom, width, height, sync]);

  if (firstRoundMatches < MIN_MATCHES) return null;

  const jump = (event: React.MouseEvent<HTMLDivElement>): void => {
    const el = scrollerRef.current;
    if (el === null) return;
    const box = event.currentTarget.getBoundingClientRect();
    const fx = (event.clientX - box.left) / box.width;
    const fy = (event.clientY - box.top) / box.height;
    el.scrollTo({
      left: fx * width * zoom - el.clientWidth / 2,
      top: fy * height * zoom - el.clientHeight / 2,
      behavior: 'smooth',
    });
  };

  const scaled = { w: width * zoom, h: height * zoom };

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

      {/*
        Decorative: it mirrors a bracket that is already on the page and
        already keyboard navigable, so it is hidden from assistive tech
        rather than duplicating every match as an unlabelled box.
      */}
      <div
        className={styles.minimap}
        style={{ aspectRatio: `${width} / ${height}` }}
        onClick={jump}
        aria-hidden="true"
        title={labels.overview}
      >
        {nodes.map((node, index) => (
          <span
            key={index}
            className={styles.dot}
            style={{
              left: `${(node.x / width) * 100}%`,
              top: `${(node.y / height) * 100}%`,
              width: `${(node.width / width) * 100}%`,
              height: `${(node.height / height) * 100}%`,
            }}
          />
        ))}
        {view.w > 0 && (
          <span
            className={styles.viewport}
            style={{
              left: `${Math.max(0, Math.min(100, (view.x / scaled.w) * 100))}%`,
              top: `${Math.max(0, Math.min(100, (view.y / scaled.h) * 100))}%`,
              width: `${Math.min(100, (view.w / scaled.w) * 100)}%`,
              height: `${Math.min(100, (view.h / scaled.h) * 100)}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
