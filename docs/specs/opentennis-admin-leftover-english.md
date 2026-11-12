# Remaining admin English

## Goal

Under the Spanish (`es-MX`) admin locale, localize the remaining English chrome
on the blog editor, draw-sheet print note, and entrants, fee, and scoring
controls. English (`en-GB`) retains the English values. Existing photographed
D1–D5 copy must remain unchanged.

Dictionary values are plain strings. Use the existing `fill()` helper for
`{name}`, `{n}`, and `{method}` placeholders.

## Existing keys to wire

| Key | es-MX | en |
|---|---|---|
| `photos` | Fotos | Photos |
| `relatedTournament` | Torneo relacionado | Related tournament |
| `entrantCount1` | 1 inscrito | 1 entrant |
| `entrantCountN` | {n} inscritos | {n} entrants |

## Blog editor

| Key | es-MX | en |
|---|---|---|
| `updateSummaryHint` | Se muestra en el blog y en la página de inicio. Si lo dejas en blanco, se usa el primer párrafo. | Shown on the blog and the home page. Leave blank to use the first paragraph. |
| `editorHeadingTitle` | Encabezado | Heading |
| `editorSubheadingTitle` | Subencabezado | Subheading |
| `editorBoldTitle` | Negrita | Bold |
| `editorItalicTitle` | Cursiva | Italic |
| `editorBulletList` | Lista | List |
| `editorBulletListTitle` | Lista con viñetas | Bulleted list |
| `editorNumberedList` | Lista numerada | Numbered list |
| `editorQuote` | Cita | Quote |
| `photosPlaceholder` | https://…/foto.jpg \| Dos jugadores en la red \| Final, C+ Singles | https://…/photo.jpg \| Two players at the net \| Final, C+ Singles |
| `photosHint` | Una foto por línea: url \| descripción \| pie. La descripción la leen los lectores de pantalla; el pie se imprime bajo la foto. Ambos son opcionales, pero una galería sin descripciones no sirve para quien no puede verla. | One photo per line: url \| description \| caption. The description is read aloud by screen readers; the caption is printed under the photo. Both are optional, but a gallery with no descriptions is unusable to anyone who cannot see it. |
| `relatedTournamentNone` | Ninguno | None |
| `publishToSite` | Publicar en el sitio público | Publish to the public site |
| `publishToSiteHint` | Si no lo marcas, se guarda como borrador y solo se ve aquí. Si ya está publicada, se conserva la fecha original; corregir una errata no la mueve al inicio. | Unchecked saves a draft, visible only here. Publishing an already-published post keeps its original date, so fixing a typo does not move it back to the top. |

The visible `H2`, `H3`, `B`, and `I` marks may remain. Their tooltips are
localized. List buttons may include a leading `•` or `1.` mark.

## Draw sheets note

| Key | es-MX | en |
|---|---|---|
| `drawSheetsNote` | Cada espacio tiene una línea, con el extremo derecho libre para anotar el marcador. Las hojas son dibujos vectoriales y se ajustan al papel que uses. Están en el idioma de esta página; cambia el idioma en un cuadro para imprimirlas en el otro. | Each slot sits on a ruled line with the right-hand end left clear, so scores can be written in as matches finish. The sheets are vector drawings and scale to whatever paper you load. They use this page’s language — switch language on a draw page to print them in the other one. |

## Entrants, fee, and scoring

| Key | es-MX | en |
|---|---|---|
| `seededCount1` | 1 sembrado | 1 seeded |
| `seededCountN` | {n} sembrados | {n} seeded |
| `unpaidCount1` | 1 sin pagar | 1 unpaid |
| `unpaidCountN` | {n} sin pagar | {n} unpaid |
| `entryFee` | Cuota de inscripción | Entry fee |
| `currency` | Moneda | Currency |
| `entryFeeAmountAria` | Importe de la cuota | Entry fee amount |
| `currencyCodeAria` | Código de moneda | Currency code |
| `freeToEnterHint` | Inscripción gratuita. Si pones una cuota, se puede pagar en línea. | Free to enter. Set a fee to offer online payment. |
| `feeOnlineHint` | Los inscritos pueden pagar con tarjeta, OXXO o SPEI después de inscribirse. | Entrants can pay by card, OXXO or SPEI after registering. |
| `feeDeskHint` | Stripe no está configurado, así que esta cuota se cobra en recepción. | Stripe is not configured, so this fee is collected at the desk. |
| `searchEntrantsPlaceholder` | Nombre o correo | Name or email |
| `searchEntrantsAria` | Buscar inscritos | Search entrants |
| `markAllPaid` | Marcar todos como pagados | Mark all paid |
| `clearSeeds` | Quitar siembras | Clear seeds |
| `markNamedPaid` | Marcar a {name} como pagado | Mark {name} paid |
| `markNamedUnpaid` | Marcar a {name} como no pagado | Mark {name} unpaid |
| `paidClickToUndo` | Pagado — pulsa para deshacer | Paid — click to undo |
| `notPaidClickToMark` | Sin pagar — pulsa para marcar como pagado | Not paid — click to mark paid |
| `awaitingPaymentClick` | En espera de {method} — pulsa para marcar como pagado de todos modos | Awaiting {method} — click to mark paid anyway |
| `awaitingPaymentFallback` | el pago | payment |
| `scoringByRound` | Por ronda | By round |
| `scoringByRoundHint` | Para un club que juega rondas cortas al inicio y una final completa. Deja una ronda en “igual que el cuadro” salvo que de verdad sea distinta. | For a club that plays short early rounds and a full final. Leave a round on “same as the draw” unless it genuinely differs. |
| `sameAsDraw` | Igual que el cuadro | Same as the draw |
| `scoringCustomPreset` | Personalizado — no es uno de los preajustes | Custom — not one of the presets |
| `scoringFormatForRound` | Puntuación para {name} | Scoring for {name} |
| `scoringBestOf3` | Al mejor de 3, tiebreak en 6-6 | Best of 3, tiebreak at 6-6 |
| `scoringBestOf3MatchTb` | Al mejor de 3, tiebreak a 10 puntos en el tercero | Best of 3, 10-point match tiebreak in the third |
| `scoringBestOf5` | Al mejor de 5 | Best of 5 |
| `scoringProSet8` | Un pro set a 8 | One pro set to 8 |
| `scoringSingleSet6` | Un set a 6 | One set to 6 |
| `scoringFast4` | Fast4 — games a 4, sin ventajas | Fast4 — games to 4, no-ad |
| `scoringAdvantageBestOf3` | Al mejor de 3, sets con ventajas, sin tiebreak | Best of 3, advantage sets, no tiebreak |

## Scope guard

- Do not restore bulk draw replacement or per-category generation controls.
- Do not change photographed D1–D5 copy or the Copa Otoño/Invierno data.
- Do not run generation, replacement, hiding, deletion, or schedule-saving
  actions against those events.
- Keep intentional tennis and payment terms in English, including Open,
  Singles, Bye/byes, C+, Fast4, OXXO, SPEI, Stripe, RET/W/O/DEF, Walkover,
  Default, Set N, tb, tiebreak, set, pro set, and admin “Round robin”.
- Do not add speculative product features or use `localeName` in the
  draw-sheet sentence.
