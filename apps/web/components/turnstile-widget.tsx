'use client';

/**
 * The Turnstile widget.
 *
 * Renders nothing at all when there is no site key, so a club without
 * Cloudflare keys sees the entry form exactly as it was — matching the
 * server, which skips verification in the same case.
 *
 * The script is loaded once per page and the widget rendered explicitly
 * rather than by Cloudflare's auto-scan, because the entry form lives inside
 * a client component that React can remount: an auto-rendered widget leaves
 * a dead iframe behind and the second render silently produces no token.
 */

import { useEffect, useRef } from 'react';
import styles from './turnstile-widget.module.css';

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

function api(): TurnstileApi | undefined {
  return (globalThis as { turnstile?: TurnstileApi }).turnstile;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (api() !== undefined) return resolve();
    const existing = document.getElementById(SCRIPT_ID);
    if (existing !== null) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile script failed')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile script failed'));
    document.head.appendChild(script);
  });
}

export function TurnstileWidget({
  siteKey,
  locale,
}: {
  /** Null when the club has no keys; the whole widget then stands down. */
  readonly siteKey: string | null;
  readonly locale: string;
}) {
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (siteKey === null) return;
    let widgetId: string | null = null;
    let cancelled = false;

    void loadScript()
      .then(() => {
        if (cancelled || holder.current === null) return;
        const turnstile = api();
        if (turnstile === undefined) return;
        widgetId = turnstile.render(holder.current, {
          sitekey: siteKey,
          // The token arrives as a hidden input named cf-turnstile-response,
          // which the server action reads straight off the FormData.
          language: locale,
          theme: 'light',
        });
      })
      .catch(() => {
        // Script blocked or offline. The server fails open on an unreachable
        // Cloudflare, so an entrant is not stranded by an ad blocker.
      });

    return () => {
      cancelled = true;
      if (widgetId !== null) api()?.remove(widgetId);
    };
  }, [siteKey, locale]);

  if (siteKey === null) return null;
  return <div ref={holder} className={styles.widget} />;
}
