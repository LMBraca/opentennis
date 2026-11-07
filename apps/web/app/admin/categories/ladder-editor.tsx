'use client';

import { useActionState, useState } from 'react';
import {
  addCategory,
  deleteCategory,
  moveCategory,
  renameCategory,
  type LadderState,
} from './actions';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import { CATEGORY_LABEL_MAX_LENGTH } from '@/lib/category-label';
import styles from './categories.module.css';

export interface LadderRow {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly draws: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

export function LadderEditor({ rows, dict }: { readonly rows: readonly LadderRow[]; readonly dict: Dictionary }) {
  const [addState, addAction, adding] = useActionState<LadderState, FormData>(addCategory, {});
  const [editState, editAction] = useActionState<LadderState, FormData>(renameCategory, {});
  const [delState, delAction] = useActionState<LadderState, FormData>(deleteCategory, {});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [labelTooLong, setLabelTooLong] = useState<Record<string, boolean>>({});
  const [newLabel, setNewLabel] = useState('');
  const [newLabelTooLong, setNewLabelTooLong] = useState(false);
  const errorText = (error: string | undefined) =>
    error === 'categoryNameTooLong'
      ? fill(dict.categoryNameTooLong, { max: String(CATEGORY_LABEL_MAX_LENGTH) })
      : error;

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
                value={labels[row.id] ?? row.code}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.length > CATEGORY_LABEL_MAX_LENGTH) {
                    setLabelTooLong((current) => ({ ...current, [row.id]: true }));
                  } else {
                    setLabels((current) => ({ ...current, [row.id]: value }));
                    setLabelTooLong((current) => ({ ...current, [row.id]: false }));
                  }
                }}
                aria-label={`Name of ${row.code}`}
              />
              <button className={styles.save} type="submit" disabled={labelTooLong[row.id]}>
                Save
              </button>
            </form>
            <span className={styles.usage}>
              {dict.categoryLabelHelp}{' '}
              {fill(dict.categoryLabelCounter, {
                used: String((labels[row.id] ?? row.code).length),
                max: String(CATEGORY_LABEL_MAX_LENGTH),
              })}
            </span>
            {labelTooLong[row.id] && (
              <span className={styles.error}>
                {fill(dict.categoryNameTooLong, { max: String(CATEGORY_LABEL_MAX_LENGTH) })}
              </span>
            )}

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

      {editState.error !== undefined && <p className={styles.error}>{errorText(editState.error)}</p>}
      {delState.error !== undefined && <p className={styles.error}>{delState.error}</p>}
      {delState.ok !== undefined && <p className={styles.ok}>{delState.ok}</p>}

      <form action={addAction} className={styles.add}>
        <input
          className={styles.code}
          name="code"
          placeholder="C-"
          aria-label="New category"
          value={newLabel}
          onChange={(event) => {
            const value = event.target.value;
            if (value.length > CATEGORY_LABEL_MAX_LENGTH) setNewLabelTooLong(true);
            else {
              setNewLabel(value);
              setNewLabelTooLong(false);
            }
          }}
          required
        />
        <span className={styles.usage}>
          {dict.categoryLabelHelp}{' '}
          {fill(dict.categoryLabelCounter, {
            used: String(newLabel.length),
            max: String(CATEGORY_LABEL_MAX_LENGTH),
          })}
        </span>
        {newLabelTooLong && (
          <span className={styles.error}>
            {fill(dict.categoryNameTooLong, { max: String(CATEGORY_LABEL_MAX_LENGTH) })}
          </span>
        )}
        <button className={styles.addButton} type="submit" disabled={adding || newLabelTooLong}>
          {adding ? 'Adding…' : 'Add category'}
        </button>
      </form>
      {addState.error !== undefined && <p className={styles.error}>{errorText(addState.error)}</p>}
      {addState.ok !== undefined && <p className={styles.ok}>{addState.ok}</p>}
    </>
  );
}
