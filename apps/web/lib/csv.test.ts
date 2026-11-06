import { describe, expect, it } from 'vitest';
import { csvField, guessMapping, parseCsv, toCsv } from './csv';

describe('csvField', () => {
  it('leaves a plain value alone', () => {
    expect(csvField('Alvarez')).toBe('Alvarez');
  });

  it('quotes a value containing a comma', () => {
    expect(csvField('Alvarez, Ana')).toBe('"Alvarez, Ana"');
  });

  it('doubles an embedded quote', () => {
    expect(csvField('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes a value containing a newline', () => {
    expect(csvField('a\nb')).toBe('"a\nb"');
  });

  it('NEUTRALISES a formula, which is the real risk in an export', () => {
    // Opened in Excel, =cmd would execute. A surname can legitimately start
    // with a hyphen, so this has to be handled rather than rejected.
    expect(csvField('=1+1')).toBe("'=1+1");
    expect(csvField('-Alvarez')).toBe("'-Alvarez");
    expect(csvField('+34 600')).toBe("'+34 600");
    expect(csvField('@handle')).toBe("'@handle");
  });

  it('renders null and undefined as empty, not as the word', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('keeps a number a number', () => {
    expect(csvField(6)).toBe('6');
    expect(csvField(0)).toBe('0');
  });
});

describe('toCsv', () => {
  it('writes a header and CRLF rows', () => {
    expect(toCsv(['a', 'b'], [[1, 2]])).toBe('a,b\r\n1,2\r\n');
  });

  it('writes a header even with no rows', () => {
    expect(toCsv(['a'], [])).toBe('a\r\n');
  });
});

describe('parseCsv', () => {
  it('reads plain rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps a comma inside quotes in one field', () => {
    expect(parseCsv('name\n"Alvarez, Ana"')).toEqual([['name'], ['Alvarez, Ana']]);
  });

  it('reads an escaped quote', () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
  });

  it('keeps a newline inside quotes', () => {
    expect(parseCsv('a\n"one\ntwo"')).toEqual([['a'], ['one\ntwo']]);
  });

  it('handles CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips the BOM Excel writes, which would corrupt the first header', () => {
    expect(parseCsv('﻿name,email\nAna,a@b.c')[0]).toEqual(['name', 'email']);
  });

  it('ignores a trailing blank line rather than importing an empty row', () => {
    expect(parseCsv('a\n1\n')).toEqual([['a'], ['1']]);
  });

  it('keeps empty fields in the middle of a row', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });

  it('round-trips through toCsv', () => {
    const rows = [
      ['Alvarez, Ana', 'a@b.c'],
      ['He said "hi"', ''],
    ];
    expect(parseCsv(toCsv(['name', 'email'], rows)).slice(1)).toEqual(rows);
  });
});

describe('guessMapping', () => {
  it('recognises the obvious English headers', () => {
    expect(guessMapping(['Name', 'Email', 'Phone', 'Seed'])).toEqual([
      'fullName',
      'email',
      'phone',
      'seed',
    ]);
  });

  it('recognises Spanish headers', () => {
    expect(guessMapping(['Nombre', 'Correo', 'Teléfono', 'Siembra'])).toEqual([
      'fullName',
      'email',
      'phone',
      'seed',
    ]);
  });

  it('does not let "partner name" steal the name column', () => {
    // "Partner name" contains "name"; checked first so it claims itself.
    expect(guessMapping(['Name', 'Partner name'])).toEqual(['fullName', 'partnerName']);
    expect(guessMapping(['Partner name', 'Name'])).toEqual(['partnerName', 'fullName']);
  });

  it('ignores a column it cannot place', () => {
    expect(guessMapping(['Notes', 'Paid?'])).toEqual(['ignore', 'ignore']);
  });

  it('does not assign the same field twice', () => {
    const mapped = guessMapping(['Name', 'Full name']);
    expect(mapped.filter((f) => f === 'fullName')).toHaveLength(1);
  });
});
