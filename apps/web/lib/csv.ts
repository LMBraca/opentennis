/**
 * CSV, both directions.
 *
 * Hand-rolled rather than a dependency, for the same reason the Markdown
 * renderer is: the surface is one escaping rule and one parsing rule, and
 * both are here where they can be read.
 *
 * Pure. No I/O.
 */

/**
 * Quote a field if it could otherwise break the row.
 *
 * The leading-character guard is NOT cosmetic: a value starting with =, +,
 * - or @ is executed as a formula when the file is opened in Excel or
 * Sheets. A player called "-Alvarez" or a label pasted from somewhere is
 * enough, so those are prefixed with a quote character. CSV injection is
 * the one real security issue in a results export.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(
  header: readonly string[],
  rows: ReadonlyArray<readonly (string | number | null | undefined)[]>,
): string {
  const lines = [header.map(csvField).join(',')];
  for (const row of rows) lines.push(row.map(csvField).join(','));
  // CRLF: Excel on Windows is the most likely destination, and it is the
  // line ending RFC 4180 specifies.
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Parse a CSV into rows.
 *
 * Handles quoted fields, escaped quotes and newlines inside quotes, which
 * is the whole reason not to use `split(',')` on a list of names — "Alvarez,
 * Ana" in one cell is common in an export from another system.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // Strip a UTF-8 BOM: Excel writes one, and it would otherwise become part
  // of the first header name and break column matching.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    // Ignore a trailing blank line rather than importing an empty entrant.
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      if (input[i + 1] === '\n') i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Guess which column is which, so the importer opens with sensible
 * selections instead of six empty dropdowns.
 *
 * Deliberately a GUESS the admin can override — the mapping UI exists
 * precisely because no heuristic survives every club's spreadsheet.
 */
export type ImportField = 'fullName' | 'partnerName' | 'email' | 'phone' | 'seed' | 'ignore';

const HINTS: ReadonlyArray<readonly [ImportField, RegExp]> = [
  ['partnerName', /partner|pareja|doubles|dobles|compa/i],
  ['fullName', /name|nombre|jugador|player|apellido/i],
  ['email', /e-?mail|correo/i],
  ['phone', /phone|tel|cel|m[oó]vil|whats/i],
  ['seed', /seed|siembra|cabeza|preclas/i],
];

export function guessMapping(header: readonly string[]): ImportField[] {
  const used = new Set<ImportField>();
  return header.map((column) => {
    for (const [field, pattern] of HINTS) {
      // Partner is checked before name on purpose: "partner name" contains
      // "name" and would otherwise be claimed as the entrant's own.
      if (pattern.test(column) && !used.has(field)) {
        used.add(field);
        return field;
      }
    }
    return 'ignore';
  });
}
