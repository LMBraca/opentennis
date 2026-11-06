'use client';

import { useActionState, useState } from 'react';
import {
  addCategory,
  deleteCategory,
  moveCategory,
  renameCategory,
  type LadderState,
} from './actions';
import styles from './categories.module.css';

export interface LadderRow {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly draws: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
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
              <input
                className={styles.code}
                name="code"
                defaultValue={row.code}
                maxLength={12}
                aria-label={`Name of ${row.code}`}
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
        <input
          className={styles.code}
          name="code"
          placeholder="C-"
          aria-label="New category"
          maxLength={12}
          required
        />
        <button className={styles.addButton} type="submit" disabled={adding}>
          {adding ? 'Adding…' : 'Add category'}
        </button>
      </form>
      {addState.error !== undefined && <p className={styles.error}>{addState.error}</p>}
      {addState.ok !== undefined && <p className={styles.ok}>{addState.ok}</p>}
    </>
  );
}
