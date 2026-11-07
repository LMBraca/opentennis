'use client';

import { useActionState } from 'react';
import { createScorekeeper, revokeScorekeeper, type TokenState } from './actions';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
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
  dict,
}: {
  readonly slug: string;
  readonly baseUrl: string;
  readonly tokens: readonly TokenRow[];
  readonly dict: Dictionary;
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
          placeholder={dict.scorekeeperExample}
          aria-label={dict.scorekeeperForLabel}
          maxLength={80}
          required
        />
        <button className={styles.createButton} type="submit" disabled={pending}>
          {pending ? dict.creatingLink : dict.createLink}
        </button>
      </form>

      {state.error !== undefined && <p className={styles.error}>{dict[state.error]}</p>}

      {state.issuedUrl !== undefined && (
        <div className={styles.issued}>
          <p className={styles.issuedNote}>
            {fill(dict.linkCreatedFor, { label: state.issuedLabel ?? '' })}
          </p>
          {/*
            Readonly rather than plain text so it can be selected and copied
            on a phone, which is where the organizer actually is when they
            hand a link over.
          */}
          <input
            className={styles.issuedUrl}
            readOnly
            value={state.issuedUrl}
            aria-label={dict.scorekeeperLink}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      {tokens.length === 0 ? (
        <p className={styles.empty}>{dict.noScorekeeperLinks}</p>
      ) : (
        <ul className={styles.list}>
          {tokens.map((token) => (
            <li key={token.id} className={styles.row} data-revoked={token.revoked ? 'true' : undefined}>
              <span className={styles.label}>{token.label}</span>
              <span className={styles.meta}>
                <span className={styles.metaItem}>
                  {fill(dict.created, { date: token.created })}
                </span>
                <span className={styles.metaItem}>
                  {token.lastUsed === null
                    ? dict.neverUsed
                    : fill(dict.lastUsed, { date: token.lastUsed })}
                </span>
              </span>
              {token.revoked ? (
                <span className={styles.revoked}>{dict.revoked}</span>
              ) : (
                <form action={revokeScorekeeper}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={token.id} />
                  <button className={styles.revokeButton} type="submit">
                    {dict.revoke}
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
