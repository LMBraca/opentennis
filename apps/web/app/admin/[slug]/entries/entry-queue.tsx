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
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
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
  dict,
  selected,
  cursor,
  onToggle,
  adjacent,
}: {
  readonly entry: Submission;
  readonly dict: Dictionary;
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
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={fill(dict.selectEntry, { name: entry.name })}
        />
      </label>
      <div className={styles.who}>
        <span className={styles.name}>{entry.name}</span>
        {entry.partnerName !== null && (
          <span className={styles.partner}>
            {fill(dict.withPartner, { partner: entry.partnerName })}
          </span>
        )}
      </div>
      <span className={styles.draw}>{entry.drawLabel}</span>
      <span className={styles.contact}>
        <span>{entry.email}</span>
        <span className={styles.muted}>{entry.phone}</span>
      </span>
      <span className={styles.when}>
        {entry.submittedAt}
        {entry.source !== null && (
          <span className={styles.muted}>{fill(dict.via, { source: entry.source })}</span>
        )}
      </span>
      {entry.status !== 'pending' && (
        <span className={styles.state}>
          {entry.status === 'accepted' ? dict.accepted : dict.rejected}
        </span>
      )}
    </li>
  );
}

function List({
  slug,
  entries,
  reviewable,
  title,
  dict,
}: {
  readonly slug: string;
  readonly entries: readonly Submission[];
  readonly reviewable: boolean;
  readonly title: string;
  readonly dict: Dictionary;
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

  /*
   * OT-19. Rejecting asks first; accepting does not.
   *
   * Not symmetry for its own sake — accepting is reversible from this same
   * screen and rejecting is the one that turns a person away, with no
   * notification sent, so the organizer has to tell them by hand. The
   * `R` key made it a single keystroke on a page where `J`/`K` move a
   * cursor, which is one slip away from rejecting the wrong entry.
   *
   * Holds the ids rather than a boolean: the keyboard path can target the
   * row under the cursor instead of the selection, and resolving that
   * twice is how the confirm ends up rejecting someone else.
   */
  const [pendingReject, setPendingReject] = useState<readonly string[] | null>(null);
  const askReject = useCallback((ids: readonly string[]) => {
    if (ids.length > 0) setPendingReject(ids);
  }, []);

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
        // OT-19: asks, like the button does. One keystroke should not turn
        // a player away.
        case 'r': if (at) askReject(selected.size > 0 ? [...selected] : [at.id]); break;
        case 'enter': if (selected.size > 0) submit('accept', [...selected]); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entries, cursor, selected, toggle, submit, askReject, reviewable]);

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
            {selected.size > 0
              ? fill(dict.selectedCount, { count: String(selected.size) })
              : dict.nothingSelected}
          </span>
          <button
            type="button"
            className={styles.accept}
            disabled={busy || selected.size === 0}
            onClick={() => submit('accept', [...selected])}
          >
            {accepting ? dict.accepting : dict.acceptSelected}
          </button>
          <button
            type="button"
            className={styles.reject}
            disabled={busy || selected.size === 0}
            onClick={() => askReject([...selected])}
          >
            {dict.rejectSelected}
          </button>
          <button
            type="button"
            className={styles.reject}
            onClick={() => setSelected(new Set(entries.map((e) => e.id)))}
          >
            {dict.selectAll}
          </button>
          <span className={styles.keys}>
            <span><kbd>J</kbd><kbd>K</kbd> {dict.move}</span>
            <span><kbd>X</kbd> {dict.select}</span>
            <span><kbd>A</kbd> {dict.accept}</span>
            <span><kbd>R</kbd> {dict.reject}</span>
          </span>
        </div>
      )}

      {/*
        OT-19. The reject confirmation, inline above the list it applies
        to. Says how many people and that nobody is told automatically,
        which is the part the button cannot say.
      */}
      {pendingReject !== null && (
        <div className={styles.rejectConfirm}>
          <p className={styles.rejectConsequence} role="alert">
            {pendingReject.length === 1
              ? dict.rejectEntryConsequence
              : `${fill(dict.rejectCountN, { n: String(pendingReject.length) })} ${dict.rejectEntryConsequence}`}
          </p>
          <div className={styles.rejectChoices}>
            <button
              type="button"
              className={styles.rejectGo}
              autoFocus
              onClick={() => {
                submit('reject', pendingReject);
                setPendingReject(null);
              }}
            >
              {dict.rejectSelected}
            </button>
            <button
              type="button"
              className={styles.rejectCancel}
              onClick={() => setPendingReject(null)}
            >
              {dict.cancel}
            </button>
          </div>
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
            dict={dict}
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
  /** OT-13. False while the draw has no matches, which changes what
      "accepted" can honestly claim. */
  drawGenerated = true,
  dict,
}: {
  readonly slug: string;
  readonly pending: readonly Submission[];
  readonly handled: readonly Submission[];
  readonly drawGenerated?: boolean;
  readonly dict: Dictionary;
}) {
  if (pending.length === 0 && handled.length === 0) {
    return (
      <p className={styles.empty}>
        {dict.noEntriesYet}
      </p>
    );
  }

  /*
   * OT-12. Accepted and rejected were one "handled" list, so somebody the
   * organizer had just turned away sat in the same group as everyone who
   * got in, separated only by a chip on the row. Who is in the tournament
   * is the question this page exists to answer; it should be readable from
   * the headings.
   */
  const accepted = handled.filter((s) => s.status === 'accepted');
  const rejected = handled.filter((s) => s.status !== 'accepted');

  return (
    <>
      <List slug={slug} entries={pending} reviewable title={dict.waitingForYou} dict={dict} />
      {accepted.length > 0 && (
        <>
          <List
            slug={slug}
            entries={accepted}
            reviewable={false}
            title={dict.acceptedEntries}
            dict={dict}
          />
          {/* OT-13: accepted is not placed. Said only while it is still
              true, so it stops appearing once the bracket exists. */}
          {!drawGenerated && (
            <p className={styles.groupNote}>{dict.acceptedAppearOnGenerate}</p>
          )}
        </>
      )}
      {rejected.length > 0 && (
        <List
          slug={slug}
          entries={rejected}
          reviewable={false}
          title={dict.rejectedEntries}
          dict={dict}
        />
      )}
    </>
  );
}
