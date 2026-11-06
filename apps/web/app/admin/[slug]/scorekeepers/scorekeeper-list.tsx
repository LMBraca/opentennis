'use client';

import { useActionState } from 'react';
import { createScorekeeper, revokeScorekeeper, type TokenState } from './actions';
import styles from './scorekeepers.module.css';

export interface TokenRow {
  readonly id: string;
  readonly label: string;
  readonly created: string;
  readonly lastUsed: string | null;
  readonly revoked: boolean;
}

export function ScorekeeperList({
  slug,
  baseUrl,
  tokens,
}: {
  readonly slug: string;
  readonly baseUrl: string;
  readonly tokens: readonly TokenRow[];
}) {
  const [state, action, pending] = useActionState<TokenState, FormData>(createScorekeeper, {});

  return (
    <>
      <form action={action} className={styles.create}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="baseUrl" value={baseUrl} />
        <input
          className={styles.input}
          name="label"
          placeholder="Marco, courts 1–2"
          aria-label="Who is this link for?"
          maxLength={80}
          required
        />
        <button className={styles.createButton} type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create link'}
        </button>
      </form>

      {state.error !== undefined && <p className={styles.error}>{state.error}</p>}

      {state.issuedUrl !== undefined && (
        <div className={styles.issued}>
          <p className={styles.issuedNote}>{state.ok}</p>
          {/*
            Readonly rather than plain text so it can be selected and copied
            on a phone, which is where the organizer actually is when they
            hand a link over.
          */}
          <input
            className={styles.issuedUrl}
            readOnly
            value={state.issuedUrl}
            aria-label="Scorekeeper link"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      {tokens.length === 0 ? (
        <p className={styles.empty}>No links yet.</p>
      ) : (
        <ul className={styles.list}>
          {tokens.map((token) => (
            <li key={token.id} className={styles.row} data-revoked={token.revoked ? 'true' : undefined}>
              <span className={styles.label}>{token.label}</span>
              <span className={styles.meta}>
                <span className={styles.metaItem}>created {token.created}</span>
                <span className={styles.metaItem}>
                  {token.lastUsed === null ? 'never used' : `last used ${token.lastUsed}`}
                </span>
              </span>
              {token.revoked ? (
                <span className={styles.revoked}>revoked</span>
              ) : (
                <form action={revokeScorekeeper}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={token.id} />
                  <button className={styles.revokeButton} type="submit">
                    Revoke
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
