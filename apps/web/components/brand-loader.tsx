/**
 * The loading screen: the club's mark, lit.
 *
 * Replaces a 48px ball-and-baseline that sat in the middle of an otherwise
 * empty white page. That read as a widget on a broken page rather than as
 * the site arriving — a loading state is the first frame of the brand, and
 * at that moment the brand is all there is to show.
 *
 * WHY A MASK, NOT THE IMAGE. The white wordmark PNG is used as a
 * `mask-image`, so its alpha channel becomes a hole in a painted surface.
 * The logo is never recoloured, redrawn or distorted — the artwork decides
 * the shape and the CSS decides what shows through it, which is how the
 * highlight can travel ACROSS the letterforms instead of over them.
 *
 * WHY CSS, NOT WEBGL. ogl is already a dependency and the home page uses
 * it, but a loading screen that waits for a script to download, parse and
 * hydrate arrives after the thing it was covering. This paints on the
 * first frame of CSS and costs nothing. The depth is a perspective tilt,
 * which is enough to make a raking highlight read as light on a solid
 * object rather than a gradient sliding past.
 *
 * Server component, for the same reason.
 *
 * Reduced motion is handled globally — globals.css stops every animation
 * for `prefers-reduced-motion: reduce`, which leaves the mark sitting
 * still and fully lit. A static splash is a fine loading screen; a
 * flashing one is not, for the people who asked not to be flashed at.
 */

import styles from './brand-loader.module.css';

export function BrandLoader({ label }: { readonly label: string }) {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <div className={styles.stage}>
        {/*
          Two layers on one silhouette: a dim base so the mark is legible
          between sweeps, and the travelling highlight over it. One layer
          alone either strobes to nothing or never reads as a flash.
        */}
        <div className={styles.mark} />
      </div>
      {/*
        Announced, not drawn. The mark carries it visually; a word under a
        logo is what makes a splash screen look like a template.
      */}
      <span className={styles.label}>{label}</span>
    </div>
  );
}
