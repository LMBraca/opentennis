/**
 * Motion tier.
 *
 * Decided once, from what the device can actually do rather than from its
 * width. Three levels:
 *
 *   off  — stills. No runtime is started at all.
 *   lite — CSS transitions only. No WebGL, no smooth-scroll hijack.
 *   full — WebGL scene plus scroll-driven timelines.
 *
 * Reduced motion and Save-Data both land on `off`, and `off` means the
 * animation code is never even imported — a user who asked for less motion
 * should not pay to download it.
 */

export type MotionTier = 'off' | 'lite' | 'full';

function hasWebGL2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

export function readMotionTier(): MotionTier {
  if (typeof window === 'undefined') return 'off';

  // An explicit override wins, so the tier can be forced while debugging.
  const preset = document.documentElement.dataset['motion'];
  if (preset === 'off' || preset === 'lite' || preset === 'full') return preset;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };

  // Save-Data is an explicit request not to spend the user's bandwidth.
  if (nav.connection?.saveData === true) return 'off';
  if (!hasWebGL2()) return 'lite';
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return 'lite';
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return 'lite';

  return 'full';
}

/**
 * Smooth scrolling is desktop-only. Hijacking scroll on a touch device
 * fights the platform's own physics and always feels worse than native.
 */
export function wantsSmoothScroll(): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia('(max-width: 1023px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return !narrow && !coarse;
}
