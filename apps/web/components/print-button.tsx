'use client';

/**
 * RV-10 — the print control on a page whose whole job is printing.
 *
 * This reverses an earlier decision, and the reasoning is worth keeping.
 * The draw-sheet page deliberately had no button: the browser's print
 * command exists on every platform, and adding one would make this the only
 * admin page shipping JavaScript to do something the browser does for free.
 *
 * That argument is about cost, and it was right about cost. It was wrong
 * about discoverability. A page titled "Hojas de cuadro" that renders a
 * sheet and offers no control reads as unfinished — it was reported as
 * broken, which settles it. Ctrl+P is only obvious to someone who already
 * knows the page is for printing.
 *
 * It hides itself when printing. The sheet's print CSS drops
 * `body header`/`nav`/`footer`, which this is none of, so the rule has to
 * be its own — otherwise the button appears on the paper.
 */

import styles from './print-button.module.css';

export function PrintButton({ label }: { readonly label: string }) {
  return (
    <div className={styles.bar}>
      <button type="button" className={styles.button} onClick={() => window.print()}>
        {label}
      </button>
    </div>
  );
}
