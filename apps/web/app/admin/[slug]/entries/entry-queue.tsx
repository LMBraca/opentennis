'use client';

/**
 * The queue list.
 *
 * Keyboard first, because clearing twenty entries with a mouse means
 * twenty round trips to a small checkbox. J and K move, A accepts, R
 * rejects, X toggles selection, and Enter accepts everything selected —
 * the shortcuts the backlog asks for, and the ones anyone who has used a
 * mail client already knows.
 *
 * Shortcuts are ignored while a text field has focus, or typing a name
 * into the reason box would start accepting rows.
 */

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { acceptEntries, rejectEntries, type QueueState } from './actions';
import styles from './entries.module.css';

export interface Submission {
  readonly id: string;
  readonly name: string;
  readonly sortKey: string;
  readonly email: string;
  readonly phone: string;
  readonly status: string;
  readonly drawLabel: string;
  readonly partnerName: string | null;
  readonly source: string | null;
  readonly submittedAt: string;
}

function Row({
  entry,
  selected,
  cursor,
  onToggle,
  adjacent,
}: {
  readonly entry: Submission;
  readonly selected: boolean;
  readonly cursor: boolean;
  readonly onToggle: () => void;
  /** True when the row above shares a surname — the duplicate signal. */
  readonly adjacent: boolean;
}) {
  return (
    <li
      className={styles.row}
      data-cursor={cursor ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      data-adjacent={adjacent ? 'true' : undefined}
      data-status={entry.status}
    >
      <label className={styles.pick}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${entry.name}`} />
      </label>
      <div className={styles.who}>
        <span className={styles.name}>{entry.name}</span>
        {entry.partnerName !== null && (
          <span className={styles.partner}>with {entry.partnerName}</span>
        )}
      </div>
      <span className={styles.draw}>{entry.drawLabel}</span>
      <span className={styles.contact}>
        <span>{entry.email}</span>
        <span className={styles.muted}>{entry.phone}</span>
      </span>
      <span className={styles.when}>
        {entry.submittedAt}
        {entry.source !== null && <span className={styles.muted}>via {entry.source}</span>}
      </span>
      {entry.status !== 'pending' && <span className={styles.state}>{entry.status}</span>}
    </li>
  );
}

function List({
  slug,
  entries,
  reviewable,
  title,
}: {
  readonly slug: string;
  readonly entries: readonly Submission[];
  readonly reviewable: boolean;
  readonly title: string;
}) {
  const [accept, acceptAction, accepting] = useActionState<QueueState, FormData>(acceptEntries, {});
  const [reject, rejectAction, rejecting] = useActionState<QueueState, FormData>(rejectEntries, {});
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const submit = useCallback(
    (which: 'accept' | 'reject', ids: readonly string[]) => {
      if (ids.length === 0) return;
      const data = new FormData();
      data.set('slug', slug);
      for (const id of ids) data.append('id', id);
      (which === 'accept' ? acceptAction : rejectAction)(data);
      setSelected(new Set());
    },
    [slug, acceptAction, rejectAction],
  );

  useEffect(() => {
    if (!reviewable) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      // Never steal a key from someone typing.
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.type !== 'checkbox') return;
      }
      const at = entries[cursor];
      switch (e.key.toLowerCase()) {
        case 'j': setCursor((c) => Math.min(c + 1, entries.length - 1)); break;
        case 'k': setCursor((c) => Math.max(c - 1, 0)); break;
        case 'x': if (at) toggle(at.id); break;
        case 'a': if (at) submit('accept', selected.size > 0 ? [...selected] : [at.id]); break;
        case 'r': if (at) submit('reject', selected.size > 0 ? [...selected] : [at.id]); break;
        case 'enter': if (selected.size > 0) submit('accept', [...selected]); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entries, cursor, selected, toggle, submit, reviewable]);

  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (entries.length === 0) return null;
  const busy = accepting || rejecting;
  const message = accept.error ?? reject.error;

  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>{title}</h2>

      {reviewable && (
        <div className={styles.bar}>
          <span className={styles.count}>
            {selected.size > 0 ? `${selected.size} selected` : 'Nothing selected'}
          </span>
          <button
            type="button"
            className={styles.accept}
            disabled={busy || selected.size === 0}
            onClick={() => submit('accept', [...selected])}
          >
            {accepting ? 'Accepting…' : 'Accept selected'}
          </button>
          <button
            type="button"
            className={styles.reject}
            disabled={busy || selected.size === 0}
            onClick={() => submit('reject', [...selected])}
          >
            Reject selected
          </button>
          <button
            type="button"
            className={styles.reject}
            onClick={() => setSelected(new Set(entries.map((e) => e.id)))}
          >
            Select all
          </button>
          <span className={styles.keys}>
            <span><kbd>J</kbd><kbd>K</kbd> move</span>
            <span><kbd>X</kbd> select</span>
            <span><kbd>A</kbd> accept</span>
            <span><kbd>R</kbd> reject</span>
          </span>
        </div>
      )}

      {message !== undefined && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}

      <ul className={styles.list} ref={listRef}>
        {entries.map((entry, i) => (
          <Row
            key={entry.id}
            entry={entry}
            selected={selected.has(entry.id)}
            cursor={reviewable && i === cursor}
            onToggle={() => toggle(entry.id)}
            // Sorted by surname, so a shared key with the row above is the
            // duplicate worth looking at.
            adjacent={i > 0 && entries[i - 1]!.sortKey.split(' ')[0] === entry.sortKey.split(' ')[0]}
          />
        ))}
      </ul>
    </section>
  );
}

export function EntryQueue({
  slug,
  pending,
  handled,
}: {
  readonly slug: string;
  readonly pending: readonly Submission[];
  readonly handled: readonly Submission[];
}) {
  if (pending.length === 0 && handled.length === 0) {
    return (
      <p className={styles.empty}>
        No entries yet. Share the entry link or a QR code and they will appear here.
      </p>
    );
  }
  return (
    <>
      <List slug={slug} entries={pending} reviewable title="Waiting for you" />
      <List slug={slug} entries={handled} reviewable={false} title="Already in the draw" />
    </>
  );
}
