import { describe, expect, it } from 'vitest';
import { dictionary } from './i18n/dictionaries';
import { entryStatusCopy } from './entry-status-copy';

describe('entryStatusCopy', () => {
  it('keeps pending and rejected player copy distinct from accepted copy', () => {
    const dict = dictionary('es');

    expect(entryStatusCopy('pending', 'singles', undefined, dict)).toEqual({
      heading: 'Inscripción recibida',
      message: 'Recibimos tu inscripción. El organizador la está revisando.',
    });
    expect(entryStatusCopy('rejected', 'singles', undefined, dict)).toEqual({
      heading: 'Inscripción no aceptada',
      message: 'Tu inscripción no fue aceptada en esta categoría.',
    });
  });

  it('uses the existing accepted doubles message', () => {
    expect(entryStatusCopy('accepted', 'doubles', 'María', dictionary('es'))).toEqual({
      heading: dictionary('es').youreIn,
      message: 'Tú y María ya están inscritos. Paga la inscripción en recepción.',
    });
  });
});
