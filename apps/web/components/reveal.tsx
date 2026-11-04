'use client';

/**
 * Scroll reveal.
 *
 * IntersectionObserver and a CSS transition — no animation library. GSAP
 * earns its weight for scrubbed timelines pinned to scroll; for "fade up
 * when it arrives" it would be a dependency doing what the platform already
 * does in six lines.
 *
 * At the `off` tier the element is simply visible from the start: no
 * observer, no transition, nothing to wait for.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { readMotionTier } from '@/lib/motion/tier';
import styles from './reveal.module.css';

export function Reveal({
  children,
  delay = 0,
}: {
  readonly children: ReactNode;
  readonly delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (readMotionTier() === 'off') return;

    const node = ref.current;
    if (node === null) return;

    // Hide only once JS is running. Content hidden by default would be
    // invisible to anyone whose JS fails, and to crawlers that do not run it.
    setShown(false);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          setShown(true);
          io.disconnect(); // reveal once; re-animating on scroll back is noise
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={styles.reveal}
      data-shown={shown}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
