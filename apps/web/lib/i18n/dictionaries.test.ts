import { describe, expect, it } from 'vitest';
import { dictionary, fill } from './dictionaries';

describe('admin copy translations', () => {
  it('provides invitation cancellation feedback in both locales', () => {
    expect(dictionary('en').inviteCancelled).toBe('Invitation cancelled.');
    expect(dictionary('es').inviteCancelled).toBe('Invitación cancelada.');
  });

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

  it('provides the remaining admin chrome in both locales', () => {
    const english = dictionary('en');
    const spanish = dictionary('es');
    const expected = {
      updateSummaryHint: [
        'Shown on the blog and the home page. Leave blank to use the first paragraph.',
        'Se muestra en el blog y en la página de inicio. Si lo dejas en blanco, se usa el primer párrafo.',
      ],
      editorHeadingTitle: ['Heading', 'Encabezado'],
      editorSubheadingTitle: ['Subheading', 'Subencabezado'],
      editorBoldTitle: ['Bold', 'Negrita'],
      editorItalicTitle: ['Italic', 'Cursiva'],
      editorBulletList: ['List', 'Lista'],
      editorBulletListTitle: ['Bulleted list', 'Lista con viñetas'],
      editorNumberedList: ['Numbered list', 'Lista numerada'],
      editorQuote: ['Quote', 'Cita'],
      editorAlignLeft: ['Left', 'Izquierda'],
      editorAlignCenter: ['Center', 'Centro'],
      editorAlignRight: ['Right', 'Derecha'],
      photos: ['Photos', 'Fotos'],
      photosPlaceholder: [
        'https://…/photo.jpg | Two players at the net | Final, C+ Singles',
        'https://…/foto.jpg | Dos jugadores en la red | Final, C+ Singles',
      ],
      photosHint: [
        'One photo per line: url | description | caption. The description is read aloud by screen readers; the caption is printed under the photo. Both are optional, but a gallery with no descriptions is unusable to anyone who cannot see it.',
        'Una foto por línea: url | descripción | pie. La descripción la leen los lectores de pantalla; el pie se imprime bajo la foto. Ambos son opcionales, pero una galería sin descripciones no sirve para quien no puede verla.',
      ],
      relatedTournament: ['Related tournament', 'Torneo relacionado'],
      relatedTournamentNone: ['None', 'Ninguno'],
      publishToSite: ['Publish to the public site', 'Publicar en el sitio público'],
      publishToSiteHint: [
        'Unchecked saves a draft, visible only here. Publishing an already-published post keeps its original date, so fixing a typo does not move it back to the top.',
        'Si no lo marcas, se guarda como borrador y solo se ve aquí. Si ya está publicada, se conserva la fecha original; corregir una errata no la mueve al inicio.',
      ],
      drawSheetsNote: [
        'Each slot sits on a ruled line with the right-hand end left clear, so scores can be written in as matches finish. The sheets are vector drawings and scale to whatever paper you load. They use this page’s language — switch language on a draw page to print them in the other one.',
        'Cada espacio tiene una línea, con el extremo derecho libre para anotar el marcador. Las hojas son dibujos vectoriales y se ajustan al papel que uses. Están en el idioma de esta página; cambia el idioma en un cuadro para imprimirlas en el otro.',
      ],
      entrantCount1: ['1 entrant', '1 inscrito'],
      entrantCountN: ['{n} entrants', '{n} inscritos'],
      seededCount1: ['1 seeded', '1 sembrado'],
      seededCountN: ['{n} seeded', '{n} sembrados'],
      unpaidCount1: ['1 unpaid', '1 sin pagar'],
      unpaidCountN: ['{n} unpaid', '{n} sin pagar'],
      entryFee: ['Entry fee', 'Cuota de inscripción'],
      currency: ['Currency', 'Moneda'],
      entryFeeAmountAria: ['Entry fee amount', 'Importe de la cuota'],
      currencyCodeAria: ['Currency code', 'Código de moneda'],
      freeToEnterHint: [
        'Free to enter. Set a fee to offer online payment.',
        'Inscripción gratuita. Si pones una cuota, se puede pagar en línea.',
      ],
      feeOnlineHint: [
        'Entrants can pay by card, OXXO or SPEI after registering.',
        'Los inscritos pueden pagar con tarjeta, OXXO o SPEI después de inscribirse.',
      ],
      feeDeskHint: [
        'Stripe is not configured, so this fee is collected at the desk.',
        'Stripe no está configurado, así que esta cuota se cobra en recepción.',
      ],
      searchEntrantsPlaceholder: ['Name or email', 'Nombre o correo'],
      searchEntrantsAria: ['Search entrants', 'Buscar inscritos'],
      markAllPaid: ['Mark all paid', 'Marcar todos como pagados'],
      clearSeeds: ['Clear seeds', 'Quitar siembras'],
      markNamedPaid: ['Mark {name} paid', 'Marcar a {name} como pagado'],
      markNamedUnpaid: ['Mark {name} unpaid', 'Marcar a {name} como no pagado'],
      columnActions: ['Actions', 'Acciones'],
      removeNamedEntrant: ['Remove {name}', 'Quitar a {name}'],
      paidClickToUndo: ['Paid — click to undo', 'Pagado — pulsa para deshacer'],
      notPaidClickToMark: ['Not paid — click to mark paid', 'Sin pagar — pulsa para marcar como pagado'],
      awaitingPaymentClick: [
        'Awaiting {method} — click to mark paid anyway',
        'En espera de {method} — pulsa para marcar como pagado de todos modos',
      ],
      awaitingPaymentFallback: ['payment', 'el pago'],
      scoringByRound: ['By round', 'Por ronda'],
      scoringByRoundHint: [
        'For a club that plays short early rounds and a full final. Leave a round on “same as the draw” unless it genuinely differs.',
        'Para un club que juega rondas cortas al inicio y una final completa. Deja una ronda en “igual que el cuadro” salvo que de verdad sea distinta.',
      ],
      sameAsDraw: ['Same as the draw', 'Igual que el cuadro'],
      scoringCustomPreset: ['Custom — not one of the presets', 'Personalizado — no es uno de los preajustes'],
      scoringFormatForRound: ['Scoring for {name}', 'Puntuación para {name}'],
      scoringBestOf3: ['Best of 3, tiebreak at 6-6', 'Al mejor de 3, tiebreak en 6-6'],
      scoringBestOf3MatchTb: [
        'Best of 3, 10-point match tiebreak in the third',
        'Al mejor de 3, tiebreak a 10 puntos en el tercero',
      ],
      scoringBestOf5: ['Best of 5', 'Al mejor de 5'],
      scoringProSet8: ['One pro set to 8', 'Un pro set a 8'],
      scoringSingleSet6: ['One set to 6', 'Un set a 6'],
      scoringFast4: ['Fast4 — games to 4, no-ad', 'Fast4 — games a 4, sin ventajas'],
      scoringAdvantageBestOf3: [
        'Best of 3, advantage sets, no tiebreak',
        'Al mejor de 3, sets con ventajas, sin tiebreak',
      ],
    } as const;

    for (const [key, [en, es]] of Object.entries(expected)) {
      expect(english[key as keyof typeof english]).toBe(en);
      expect(spanish[key as keyof typeof spanish]).toBe(es);
    }

    expect(fill(english.removeNamedEntrant, { name: 'Ana' })).toBe('Remove Ana');
    expect(fill(spanish.removeNamedEntrant, { name: 'Ana' })).toBe('Quitar a Ana');
  });
});
