import { describe, expect, it } from 'vitest';
import { dictionary } from './dictionaries';

describe('admin copy translations', () => {
  it('provides the photographed admin labels in both locales', () => {
    const english = dictionary('en');
    const spanish = dictionary('es');
    const expected = {
      newUpdateTitle: ['New post', 'Nueva publicación'],
      editUpdateTitle: ['Edit post', 'Editar publicación'],
      backToUpdates: ['Back to the blog', 'Volver al blog'],
      writePost: ['Write a post', 'Escribir publicación'],
      updateTitleLabel: ['Title', 'Título'],
      updateSummaryLabel: ['Summary', 'Resumen'],
      updateBodyLabel: ['Body', 'Texto'],
      uploadImageLabel: ['Upload image', 'Subir imagen'],
      coverImageLabel: ['Cover image', 'Imagen de portada'],
      coverDescriptionLabel: [
        'Cover description — what the photo shows',
        'Descripción de la portada: qué muestra la foto',
      ],
      saveUpdate: ['Save post', 'Guardar publicación'],
      uploadingImage: ['Uploading…', 'Subiendo…'],
      replaceImage: ['Replace image', 'Reemplazar imagen'],
      removeImage: ['Remove', 'Quitar'],
      drawSheetsLead: [
        'One sheet per draw, each on its own page. Print in landscape.',
        'Una hoja por cuadro, cada una en su propia página. Imprime en horizontal.',
      ],
      sheetCount1: ['1 sheet', '1 hoja'],
      sheetCountN: ['{n} sheets', '{n} hojas'],
      entrantsSeed: ['Seed', 'Siembra'],
      seedForEntrant: ['Seed for {name}', 'Siembra para {name}'],
      entrantsName: ['Name', 'Nombre'],
      entrantsContact: ['Contact', 'Contacto'],
      entrantsPaid: ['Paid', 'Pagado'],
      team: ['Team', 'Equipo'],
      saveSeeds: ['Save seeds', 'Guardar siembras'],
      save: ['Save', 'Guardar'],
      importCsv: ['Import a CSV', 'Importar un CSV'],
      addEntrantsManually: ['Add entrants manually', 'Agregar inscritos a mano'],
      separatePlayers: ['Separate two players', 'Separar a dos jugadores'],
      thirdPlacePlayoff: [
        'Play a third-place playoff in this draw.',
        'Jugar un partido por el tercer puesto en este cuadro.',
      ],
      scoringTitle: ['Scoring', 'Puntuación'],
      saveFee: ['Save fee', 'Guardar cuota'],
      scoringHint: [
        'Applies to every match in this draw unless a round below says otherwise.',
        'Se aplica a todos los partidos de este cuadro, salvo que una ronda indique otra cosa.',
      ],
      csvColumnQuestion: ['What is in {column}?', '¿Qué contiene {column}?'],
      csvColumn: ['Column {n}', 'Columna {n}'],
      noDrawsToPrint: [
        'There are no draws to print yet. Generate a draw first.',
        'Todavía no hay cuadros para imprimir. Genera un cuadro primero.',
      ],
      noDrawsGenerated: [
        'No draws have been generated yet.',
        'Todavía no se ha generado ningún cuadro.',
      ],
    } as const;

    for (const [key, [en, es]] of Object.entries(expected)) {
      expect(english[key as keyof typeof english]).toBe(en);
      expect(spanish[key as keyof typeof spanish]).toBe(es);
    }

    expect(spanish.seedSeparationHint).toBe(
      'Escribe 1 y 2 en Siembra para que tus dos más fuertes no se enfrenten hasta la final.',
    );
    expect(english.seedSeparationHint).toBe(
      'Enter 1 and 2 under Seed so your two strongest do not meet until the final.',
    );
  });
});
