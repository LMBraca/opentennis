'use client';

import { useActionState } from 'react';
import {
  createScorekeeper,
  replaceScorekeeper,
  revokeScorekeeper,
  type TokenState,
} from './actions';
import { ConfirmAction } from '@/components/confirm-action';
import { CopyButton } from '@/components/copy-button';
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
  /*
   * OT-10. Replacement reports through its own state, and either action
   * can be the one holding the URL to show. Whichever ran last wins — a
   * stale URL from the other is a link the organizer might hand over
   * believing it works.
   */
  const [replaceState, replaceAction] = useActionState<TokenState, FormData>(
    replaceScorekeeper,
    {},
  );
  const issuedUrl = replaceState.issuedUrl ?? state.issuedUrl;
  const issuedLabel = replaceState.issuedUrl !== undefined ? replaceState.issuedLabel : state.issuedLabel;

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

      {issuedUrl !== undefined && (
        <div className={styles.issued}>
          <p className={styles.issuedNote}>
            {fill(dict.linkCreatedFor, { label: issuedLabel ?? '' })}
          </p>
          {/*
            Readonly rather than plain text so it can be selected and copied
            on a phone, which is where the organizer actually is when they
            hand a link over.
          */}
          <input
            className={styles.issuedUrl}
            readOnly
            value={issuedUrl}
            aria-label={dict.scorekeeperLink}
            onFocus={(e) => e.currentTarget.select()}
          />
          {/*
            OT-10. "Copy it now" with nothing to copy it WITH. The entry
            share field had Copy and Open from the start; this one, the
            link that is handed to a person standing on a court, had
            neither — so the organizer selected a 60-character URL by hand
            on a phone.
          */}
          <div className={styles.issuedActions}>
            <CopyButton
              value={issuedUrl}
              label={dict.copy}
              copiedLabel={dict.copied}
              className={styles.issuedButton}
            />
            <a
              className={styles.issuedButton}
              href={issuedUrl}
              target="_blank"
              rel="noreferrer"
            >
              {dict.openLink}
            </a>
          </div>
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
                /*
                  OT-19. Revoke asked nothing and took effect instantly.
                  It is the one admin action whose damage lands on someone
                  ELSE, mid-match, on a court — the consequence line says
                  so, because the button cannot.
                */
                <span className={styles.rowActions}>
                  {/*
                    OT-10. QA wanted a Copy button on existing rows. There
                    is nothing to copy: the stored value is a HASH, so the
                    URL genuinely cannot be shown again — and should not
                    be, since a credential re-readable from the admin panel
                    forever is worse than a lost link. Replacement is the
                    honest answer, and it shows the new URL once.
                  */}
                  <ConfirmAction
                    action={replaceAction}
                    label={dict.replaceLink}
                    confirmLabel={dict.replaceLink}
                    consequence={dict.replaceLinkConsequence}
                    cancelLabel={dict.cancel}
                    className={styles.revokeButton}
                  >
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="baseUrl" value={baseUrl} />
                    <input type="hidden" name="id" value={token.id} />
                  </ConfirmAction>
                  <ConfirmAction
                    action={revokeScorekeeper}
                    label={dict.revoke}
                    confirmLabel={dict.revoke}
                    consequence={dict.revokeLinkConsequence}
                    cancelLabel={dict.cancel}
                    danger
                    className={styles.revokeButton}
                  >
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={token.id} />
                  </ConfirmAction>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
