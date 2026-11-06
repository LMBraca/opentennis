'use client';

/**
 * The directory list, and the merge that goes with it.
 *
 * Picking a canonical player is the whole interaction, so it is a RADIO per
 * row rather than a dropdown of names somewhere else: the row you keep is
 * the one you can see the entries of. Tick the others, choose the keeper,
 * merge.
 *
 * The merge is destructive to one row and reversible from the log below it,
 * so the button says how many entries will move before it is pressed. A
 * confirmation nobody can act on — "are you sure?" — is not a safeguard.
 */

import { useActionState, useState } from 'react';
import { mergePlayers, undoMerge, type MergeState } from './actions';
import styles from './players.module.css';

export interface DirectoryPlayer {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly entries: readonly string[];
  /** Index of the look-alike group this player is in, or null. */
  readonly duplicateGroup: number | null;
}

export interface MergeRecord {
  readonly id: string;
  readonly mergedName: string;
  readonly canonicalName: string;
  readonly reverted: boolean;
  readonly when: string;
}

export function PlayerDirectory({
  players,
  history,
}: {
  readonly players: readonly DirectoryPlayer[];
  readonly history: readonly MergeRecord[];
}) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [canonical, setCanonical] = useState<string | null>(null);
  const [mergeState, mergeAction, mergePending] = useActionState<MergeState, FormData>(
    mergePlayers,
    {},
  );
  const [undoState, undoAction, undoPending] = useActionState<MergeState, FormData>(undoMerge, {});

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Keeping a player who is no longer selected would merge them into
      // themselves, so the choice is dropped with the tick.
      if (canonical !== null && !next.includes(canonical)) setCanonical(null);
      return next;
    });
  };

  const chosen = players.filter((p) => selected.includes(p.id));
  const movingEntries = chosen
    .filter((p) => p.id !== canonical)
    .reduce((n, p) => n + p.entries.length, 0);

  return (
    <>
      {selected.length >= 2 && (
        <form action={mergeAction} className={styles.mergeBar}>
          <input type="hidden" name="canonicalId" value={canonical ?? ''} />
          {chosen
            .filter((p) => p.id !== canonical)
            .map((p) => (
              <input key={p.id} type="hidden" name="mergedId" value={p.id} />
            ))}

          <span className={styles.mergeCount}>
            {selected.length} selected
          </span>

          <span className={styles.mergeKeep}>
            {canonical === null
              ? 'Choose which one to keep'
              : `Keeping ${
                  chosen.find((p) => p.id === canonical)?.firstName ?? ''
                } ${chosen.find((p) => p.id === canonical)?.lastName ?? ''}`}
          </span>

          <button
            className={styles.mergeButton}
            type="submit"
            disabled={canonical === null || mergePending}
          >
            {mergePending
              ? 'Merging…'
              : `Merge ${selected.length - 1} in, moving ${movingEntries} ${
                  movingEntries === 1 ? 'entry' : 'entries'
                }`}
          </button>
        </form>
      )}

      {mergeState.error !== undefined && <p className={styles.error}>{mergeState.error}</p>}
      {mergeState.ok !== undefined && <p className={styles.ok}>{mergeState.ok}</p>}
      {undoState.error !== undefined && <p className={styles.error}>{undoState.error}</p>}
      {undoState.ok !== undefined && <p className={styles.ok}>{undoState.ok}</p>}

      <ul className={styles.list}>
        {players.map((player, index) => {
          const previous = players[index - 1];
          // A hairline, not a badge. The sort already puts look-alikes
          // together; the rule just says where one pair ends and the next
          // begins. A label that is wrong is worse than no label (ENT-8).
          const joined =
            previous !== undefined &&
            player.duplicateGroup !== null &&
            previous.duplicateGroup === player.duplicateGroup;

          return (
            <li
              key={player.id}
              className={styles.row}
              data-joined={joined ? 'true' : undefined}
              data-selected={selected.includes(player.id) ? 'true' : undefined}
            >
              <label className={styles.pick}>
                <input
                  type="checkbox"
                  checked={selected.includes(player.id)}
                  onChange={() => toggle(player.id)}
                  aria-label={`Select ${player.firstName} ${player.lastName}`}
                />
              </label>

              <div className={styles.who}>
                <span className={styles.name}>
                  {player.lastName}, {player.firstName}
                </span>
                <span className={styles.contact}>
                  {player.email !== null && player.email !== '' && (
                    <span className={styles.contactItem}>{player.email}</span>
                  )}
                  {player.phone !== null && player.phone !== '' && (
                    <span className={styles.contactItem}>{player.phone}</span>
                  )}
                </span>
              </div>

              <div className={styles.entries}>
                {player.entries.length === 0 ? (
                  <span className={styles.noEntries}>no entries</span>
                ) : (
                  player.entries.map((entry) => (
                    <span key={entry} className={styles.entry}>
                      {entry}
                    </span>
                  ))
                )}
              </div>

              {selected.includes(player.id) && (
                <label className={styles.keep}>
                  <input
                    type="radio"
                    name="keep"
                    checked={canonical === player.id}
                    onChange={() => setCanonical(player.id)}
                    aria-label={`Keep ${player.firstName} ${player.lastName}`}
                  />
                  keep
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {history.length > 0 && (
        <section className={styles.history}>
          <h2 className={styles.historyTitle}>Merges</h2>
          <ul className={styles.historyList}>
            {history.map((record) => (
              <li key={record.id} className={styles.historyRow}>
                <span className={styles.historyWhen}>{record.when}</span>
                <span className={styles.historyWhat}>
                  {record.mergedName} into {record.canonicalName}
                </span>
                {record.reverted ? (
                  <span className={styles.undone}>undone</span>
                ) : (
                  <form action={undoAction}>
                    <input type="hidden" name="mergeId" value={record.id} />
                    <button className={styles.undoButton} type="submit" disabled={undoPending}>
                      Undo
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
