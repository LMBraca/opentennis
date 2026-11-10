import { describe, expect, it } from 'vitest';
import { dictionary } from './dictionaries';

describe('admin copy translations', () => {
  it('provides the photographed admin labels in both locales', () => {
    const english = dictionary('en');
    const spanish = dictionary('es');
    const expected = {
      adminNewUpdate: ['New update', 'Nueva actualización'],
      adminEditUpdate: ['Edit update', 'Editar actualización'],
      adminBackToUpdates: ['Back to updates', 'Volver a las actualizaciones'],
      updateTitleLabel: ['Title', 'Título'],
      updateSummaryLabel: ['Summary', 'Resumen'],
      updateBodyLabel: ['Body', 'Texto'],
      uploadImageLabel: ['Upload image', 'Subir imagen'],
      coverImageLabel: ['Cover image', 'Imagen de portada'],
      saveUpdateLabel: ['Save update', 'Guardar actualización'],
      drawSheetsLead: [
        'One sheet per draw, each on its own page. Print in landscape.',
        'Una hoja por categoría, cada una en su propia página. Imprime en orientación horizontal.',
      ],
      sheetCountOne: ['sheet', 'hoja'],
      sheetCountMany: ['sheets', 'hojas'],
      entrantsSeed: ['Seed', 'Siembra'],
      seedForEntrant: ['Seed for {name}', 'Siembra para {name}'],
      entrantsName: ['Name', 'Nombre'],
      entrantsContact: ['Contact', 'Contacto'],
      entrantsPaid: ['Paid', 'Pagado'],
      saveSeeds: ['Save seeds', 'Guardar siembras'],
      importCsv: ['Import a CSV', 'Importar un CSV'],
      addEntrantsManually: ['Add entrants manually', 'Agregar inscritos manualmente'],
      separatePlayers: ['Separate two players', 'Separar a dos jugadores'],
      thirdPlacePlayoff: [
        'Play a third-place playoff in this draw',
        'Jugar por el tercer lugar en esta categoría',
      ],
      scoringTitle: ['Scoring', 'Puntuación'],
    } as const;

    for (const [key, [en, es]] of Object.entries(expected)) {
      expect(english[key as keyof typeof english]).toBe(en);
      expect(spanish[key as keyof typeof spanish]).toBe(es);
    }

    expect(spanish.seedSeparationHint).toMatch(/^¿Quieres/);
    expect(english.seedSeparationHint).toMatch(/^Want/);
  });
});
