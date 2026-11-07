'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import {
  createScorekeeper,
  replaceScorekeeper,
  revokeScorekeeper,
  type TokenState,
} from './actions';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import styles from './scorekeepers.module.css';

export interface TokenRow {
  readonly id: string;
  readonly label: string;
  readonly created: string;
  readonly lastUsed: string | null;
  readonly revoked: boolean;
}

function IssuedLink({ url, dict }: { readonly url: string; readonly dict: Dictionary }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      inputRef.current?.select();
    }
  };

  return (
    <div className={styles.issued}>
      <input
        ref={inputRef}
        className={styles.issuedUrl}
        readOnly
        value={url}
        aria-label={dict.scorekeeperLink}
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className={styles.linkActions}>
        <button className={styles.linkButton} type="button" onClick={() => void copy()}>
          {dict.copy}
        </button>
        <a className={styles.linkButton} href={url} target="_blank" rel="noopener noreferrer">
          {dict.openLink}
        </a>
        {copied && <span className={styles.copied} role="status">{dict.copied}</span>}
      </div>
    </div>
  );
}

function ScorekeeperRow({
  slug,
  baseUrl,
  token,
  dict,
  createdUrl,
}: {
  readonly slug: string;
  readonly baseUrl: string;
  readonly token: TokenRow;
  readonly dict: Dictionary;
  readonly createdUrl?: string | undefined;
}) {
  const [replaceState, replaceAction, replacing] = useActionState<TokenState, FormData>(
    replaceScorekeeper,
    {},
  );
  const [confirm, setConfirm] = useState<'replace' | 'revoke' | null>(null);
  useEffect(() => {
    if (replaceState.issuedUrl !== undefined) setConfirm(null);
  }, [replaceState.issuedUrl]);

  return (
    <li className={styles.row} data-revoked={token.revoked ? 'true' : undefined}>
      <span className={styles.label}>{token.label}</span>
      <span className={styles.meta}>
        <span className={styles.metaItem}>{fill(dict.created, { date: token.created })}</span>
        <span className={styles.metaItem}>
          {token.lastUsed === null
            ? dict.neverUsed
            : fill(dict.lastUsed, { date: token.lastUsed })}
        </span>
      </span>
      {token.revoked ? (
        <span className={styles.revoked}>{dict.revoked}</span>
      ) : (
        <div className={styles.tokenActions}>
          <button className={styles.revokeButton} type="button" onClick={() => setConfirm('replace')}>
            {dict.replaceLink}
          </button>
          <button className={styles.revokeButton} type="button" onClick={() => setConfirm('revoke')}>
            {dict.revoke}
          </button>
        </div>
      )}
      {createdUrl !== undefined && (
        <div>
          <p className={styles.issuedNote}>{fill(dict.linkCreatedFor, { label: token.label })}</p>
          <IssuedLink url={createdUrl} dict={dict} />
        </div>
      )}
      {replaceState.error !== undefined && <p className={styles.error}>{dict[replaceState.error]}</p>}
      {replaceState.issuedUrl !== undefined && (
        <IssuedLink url={replaceState.issuedUrl} dict={dict} />
      )}
      {confirm !== null && (
        <div className={styles.confirmBackdrop}>
          <section className={styles.confirmDialog} role="dialog" aria-modal="true">
            <h3>{confirm === 'replace' ? dict.confirmReplaceTitle : dict.confirmRevokeTitle}</h3>
            <p>{confirm === 'replace' ? dict.confirmReplaceBody : dict.confirmRevokeBody}</p>
            <div className={styles.confirmActions}>
              {confirm === 'replace' ? (
                <form action={replaceAction} onSubmit={() => setConfirm(null)}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={token.id} />
                  <input type="hidden" name="baseUrl" value={baseUrl} />
                  <button className={styles.confirmDanger} type="submit" disabled={replacing}>
                    {replacing ? dict.creatingLink : dict.replaceLink}
                  </button>
                </form>
              ) : (
                <form action={revokeScorekeeper} onSubmit={() => setConfirm(null)}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={token.id} />
                  <button className={styles.confirmDanger} type="submit">{dict.revoke}</button>
                </form>
              )}
              <button
                className={styles.confirmCancel}
                type="button"
                onClick={() => setConfirm(null)}
              >
                {dict.cancel}
              </button>
            </div>
          </section>
        </div>
      )}
    </li>
  );
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
  const issuedOnRow = tokens.some((token) => token.id === state.issuedId);

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

      {state.issuedUrl !== undefined && !issuedOnRow && (
        <div>
          <p className={styles.issuedNote}>
            {fill(dict.linkCreatedFor, { label: state.issuedLabel ?? '' })}
          </p>
          <IssuedLink url={state.issuedUrl} dict={dict} />
        </div>
      )}

      {tokens.length === 0 ? (
        <p className={styles.empty}>{dict.noScorekeeperLinks}</p>
      ) : (
        <ul className={styles.list}>
          {tokens.map((token) => (
            <ScorekeeperRow
              key={token.id}
              slug={slug}
              baseUrl={baseUrl}
              token={token}
              dict={dict}
              {...(state.issuedId === token.id && state.issuedUrl !== undefined
                ? { createdUrl: state.issuedUrl }
                : {})}
            />
          ))}
        </ul>
      )}
    </>
  );
}
