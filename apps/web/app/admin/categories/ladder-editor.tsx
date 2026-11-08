'use client';

import { useActionState, useState } from 'react';
import {
  addCategory,
  deleteCategory,
  moveCategory,
  renameCategory,
  type LadderState,
} from './actions';
import { CATEGORY_LABEL_MAX, categoryLabelLength } from '@/lib/category-label';
import styles from './categories.module.css';

export interface LadderRow {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly draws: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

/**
 * OT-21 — a name field that shows its own limit.
 *
 * The counter is the point. The old field truncated at 12 after the fact,
 * so the first time an organizer learned about the limit was when the
 * name came back shorter than they typed it. Here the budget is visible
 * before it runs out, and `maxLength` refuses the extra character at the
 * keystroke rather than on save.
 */
function NameField({
  name,
  initial,
  ariaLabel,
  className,
  placeholder,
}: {
  readonly name: string;
  readonly initial: string;
  readonly ariaLabel: string;
  /** `| undefined` because a CSS-module member is typed that way under
      noUncheckedIndexedAccess — the trap CLAUDE.md names. */
  readonly className: string | undefined;
  readonly placeholder?: string | undefined;
}) {
  const [value, setValue] = useState(initial);
  const used = categoryLabelLength(value);
  // Only once it is worth knowing. A counter sitting at 3/40 is furniture.
  const near = used >= CATEGORY_LABEL_MAX - 8;

  return (
    <span className={styles.nameField}>
      <input
        className={className}
        name={name}
        value={value}
        maxLength={CATEGORY_LABEL_MAX}
        aria-label={ariaLabel}
        aria-describedby={near ? `${name}-count` : undefined}
        onChange={(e) => setValue(e.target.value)}
        {...(placeholder === undefined ? {} : { placeholder })}
      />
      {near && (
        <span id={`${name}-count`} className={styles.counter} data-full={used >= CATEGORY_LABEL_MAX}>
          {used}/{CATEGORY_LABEL_MAX}
        </span>
      )}
    </span>
  );
}

export function LadderEditor({ rows }: { readonly rows: readonly LadderRow[] }) {
  const [addState, addAction, adding] = useActionState<LadderState, FormData>(addCategory, {});
  const [editState, editAction] = useActionState<LadderState, FormData>(renameCategory, {});
  const [delState, delAction] = useActionState<LadderState, FormData>(deleteCategory, {});
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.id} className={styles.row}>
            <div className={styles.order}>
              <form action={moveCategory}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="direction" value="up" />
                <button
                  className={styles.move}
                  type="submit"
                  disabled={row.isFirst}
                  aria-label={`Move ${row.code} up`}
                >
                  ↑
                </button>
              </form>
              <form action={moveCategory}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  className={styles.move}
                  type="submit"
                  disabled={row.isLast}
                  aria-label={`Move ${row.code} down`}
                >
                  ↓
                </button>
              </form>
            </div>

            <form action={editAction} className={styles.rename}>
              <input type="hidden" name="id" value={row.id} />
              {/*
                OT-21. `maxLength` is the limit, not a `.slice` after the
                fact — the browser stops the extra character at the point
                it is typed, which is the only moment the organizer can
                act on it. 12 silently became "QA Test Cate".
              */}
              <NameField
                name="code"
                initial={row.code}
                ariaLabel={`Name of ${row.code}`}
                className={styles.code}
              />
              <button className={styles.save} type="submit">
                Save
              </button>
            </form>

            <span className={styles.usage}>
              {row.draws === 0 ? 'unused' : `${row.draws} ${row.draws === 1 ? 'draw' : 'draws'}`}
            </span>

            {confirming === row.id ? (
              <form action={delAction} className={styles.confirm}>
                <input type="hidden" name="id" value={row.id} />
                <input
                  className={styles.code}
                  name="confirmCode"
                  placeholder={row.code}
                  aria-label={`Type ${row.code} to confirm`}
                  autoComplete="off"
                />
                <button className={styles.delete} type="submit">
                  Delete
                </button>
              </form>
            ) : (
              <button
                className={styles.remove}
                type="button"
                onClick={() => setConfirming(row.id)}
                disabled={row.draws > 0}
                /* Disabled rather than hidden: "why can I not delete this"
                   is answered by the draw count sitting next to it. */
                title={row.draws > 0 ? 'In use by a draw' : undefined}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {editState.error !== undefined && <p className={styles.error}>{editState.error}</p>}
      {delState.error !== undefined && <p className={styles.error}>{delState.error}</p>}
      {delState.ok !== undefined && <p className={styles.ok}>{delState.ok}</p>}

      <form action={addAction} className={styles.add}>
        <NameField
          name="code"
          initial=""
          placeholder="C-"
          ariaLabel="New category"
          className={styles.code}
        />
        <button className={styles.addButton} type="submit" disabled={adding}>
          {adding ? 'Adding…' : 'Add category'}
        </button>
      </form>
      {/* OT-21. The limit, said once, where a new name is typed. The field
          itself stops at 40; this explains what the number is FOR. */}
      <p className={styles.addHint}>This is how it will appear on the draw.</p>
      {addState.error !== undefined && <p className={styles.error}>{addState.error}</p>}
      {addState.ok !== undefined && <p className={styles.ok}>{addState.ok}</p>}
    </>
  );
}
