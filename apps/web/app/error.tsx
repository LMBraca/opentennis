'use client';

/**
 * The error boundary.
 *
 * There was none, so any throw from a server component — a database blip
 * mid-tournament being the realistic one — fell through to Next's default.
 * In production that is an unbranded "Application error" with no way back,
 * shown to a player who scanned a poster off a wall.
 *
 * Every app has one of these. It is a convention, not an invention.
 *
 * It reuses the 404 page's markup and classes rather than inventing a
 * third full-page layout — the same mistake the footer made. What it does
 * NOT reuse is `PageHeader`: that is a server component and this boundary
 * has to be a client one, and more to the point, whatever just failed may
 * be the thing a masthead would need to render itself. It reads no
 * database, no tournament and no dictionary.
 *
 * Spanish, because that is the product default and a cookie lookup here is
 * one more thing that can throw inside an error handler.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './not-found.module.css';

export default function Error({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // The digest is how a report in the wild gets matched to a server log.
    // The message itself is not rendered — it can carry internals.
    console.error('Unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <main>
      <div className={styles.errorPage}>
        <h1 className={styles.errorTitle}>Algo salió mal</h1>
        <p className={styles.body}>
          No pudimos cargar esta página. Vuelve a intentarlo; si sigue fallando, avisa al
          organizador.
        </p>
        <nav className={styles.actions} aria-label="Algo salió mal">
          <button type="button" className={styles.retry} onClick={reset}>
            Reintentar
          </button>
          <Link href="/">Ir al inicio</Link>
        </nav>
      </div>
    </main>
  );
}
