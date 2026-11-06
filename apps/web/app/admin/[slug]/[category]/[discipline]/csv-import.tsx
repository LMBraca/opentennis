'use client';

/**
 * ADM-7b — CSV import, in two steps.
 *
 * Read the file first and show what was found; import only once the admin
 * has confirmed which column is which. A one-shot importer that guesses
 * wrong creates forty entrants named after an email address, and the only
 * way back is deleting them one at a time.
 *
 * Collapsed by default. The paste box above it is the common path — this is
 * for the club that keeps a spreadsheet.
 */

import { useActionState, useState } from 'react';
import {
  importCsv,
  previewCsv,
  type ActionState,
  type ImportPreview,
} from '../../../tournament-actions';
import styles from './entrants.module.css';

const FIELDS = [
  { value: 'fullName', label: 'Name' },
  { value: 'partnerName', label: 'Partner' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'seed', label: 'Seed' },
  { value: 'ignore', label: 'Ignore' },
] as const;

export function CsvImport({
  slug,
  eventId,
  isDoubles,
}: {
  readonly slug: string;
  readonly eventId: string;
  readonly isDoubles: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [preview, previewAction, reading] = useActionState<ImportPreview, FormData>(
    previewCsv,
    {},
  );
  const [result, importAction, importing] = useActionState<ActionState, FormData>(importCsv, {});

  if (!open) {
    return (
      <button className={styles.ghost} type="button" onClick={() => setOpen(true)}>
        Import a CSV
      </button>
    );
  }

  return (
    <section className={styles.csv}>
      <h3 className={styles.csvTitle}>Import a CSV</h3>

      <form action={previewAction} className={styles.csvForm}>
        <input className={styles.file} type="file" name="file" accept=".csv,text/csv" />
        <button className={styles.ghost} type="submit" disabled={reading}>
          {reading ? 'Reading…' : 'Read file'}
        </button>
      </form>

      {preview.error !== undefined && <p className={styles.csvError}>{preview.error}</p>}
      {preview.ok !== undefined && <p className={styles.csvOk}>{preview.ok}</p>}

      {preview.header !== undefined && preview.payload !== undefined && (
        <form action={importAction} className={styles.mapping}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="payload" value={preview.payload} />

          <table className={styles.mapTable}>
            <thead>
              <tr>
                <th className={styles.mapTh} scope="col">Column</th>
                <th className={styles.mapTh} scope="col">Becomes</th>
                <th className={styles.mapTh} scope="col">First rows</th>
              </tr>
            </thead>
            <tbody>
              {preview.header.map((column, index) => (
                <tr key={`${column}-${index}`}>
                  <td className={styles.mapTd}>{column === '' ? `Column ${index + 1}` : column}</td>
                  <td className={styles.mapTd}>
                    {/* One select per column, in column order, so the
                        action can read them positionally with getAll. */}
                    <select
                      className={styles.select}
                      name="mapping"
                      defaultValue={preview.mapping?.[index] ?? 'ignore'}
                      aria-label={`What is in ${column === '' ? `column ${index + 1}` : column}?`}
                    >
                      {FIELDS.filter((f) => f.value !== 'partnerName' || isDoubles).map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.mapSample}>
                    {(preview.sample ?? []).map((row, r) => (
                      <span key={r} className={styles.sampleValue}>
                        {row[index] ?? ''}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className={styles.primary} type="submit" disabled={importing}>
            {importing ? 'Importing…' : 'Import these rows'}
          </button>
        </form>
      )}

      {result.error !== undefined && <p className={styles.csvError}>{result.error}</p>}
      {result.ok !== undefined && <p className={styles.csvOk}>{result.ok}</p>}
    </section>
  );
}
