# Final leftovers: draws/entrants English and bulk draw-replacement restore

## Goal

1. Replace the remaining English text in the public category-switcher
   accessible name and the admin entrants document title with their existing
   dictionary values. Spanish (`es-MX`) is the default; English remains the
   translation.
2. Restore the confirmed bulk draw-replacement path. It may replace only
   eligible existing draws with recorded results, after an OT-9 confirmation
   enforced by the server. Keep current first-time draw generation, including
   its unpaid-entry gate. Do not change `redrawEvent`.

## Localization

- The public draw-switcher navigation name uses the existing `draws` string:
  “Categorías” in Spanish and “Draws” in English.
- The admin entrants page title uses the existing `entrants` string and keeps
  the root title template: `{entrants} · OpenTennis`.
- Restore these dictionary values:

| Key                      | Spanish                                                                                                                                                                  | English                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `generateAgain`          | Generar de nuevo                                                                                                                                                         | Generate again                                                                                                                                               |
| `bulkReplaceTitle`       | Generar los cuadros de nuevo                                                                                                                                             | Generate draws again                                                                                                                                         |
| `bulkReplaceSummary`     | Se reemplazarán {n} resultados en {draws}.                                                                                                                               | {n} recorded results will be replaced in {draws}.                                                                                                            |
| `bulkReplaceHelper`      | Esta acción no se puede deshacer desde aquí.                                                                                                                             | This cannot be undone from here.                                                                                                                             |
| `bulkResultsChanged`     | Los resultados cambiaron desde la confirmación. Este cuadro quedó intacto; puede que otros ya se hayan reemplazado. Revisa la lista actual antes de intentarlo de nuevo. | Results changed since confirmation. This draw was left unchanged; earlier draws may already have been replaced. Review the current list before trying again. |
| `bulkResultsNeedConfirm` | Hay resultados guardados. Revisa la lista y confirma antes de reemplazarlos.                                                                                             | Recorded results are present. Review the list and confirm before replacing them.                                                                             |

Use the existing `fill()` helper for `{n}` and `{draws}`; reuse `cancel` and
`recorded`. These values are plain strings.

## Bulk replacement behavior

- Eligible event statuses are `draft`, `ready`, and `published`.
- Show a bulk control while entries are closed and the organizer can manage
  draws if an eligible event has recorded results, even if every running event
  already has a draw.
- Clicking while results exist opens a dialog without writing. It lists every
  affected draw and its recorded-result count, and includes the localized
  title, summary, helper, confirm button, and existing cancel label.
- The server requires `confirmBulkReplace=true` when eligible recorded results
  exist. It compares `expectedResults` with a current `drawResultSnapshot` and
  refuses stale confirmations without writing that draw. Recheck under a row
  lock and transaction while replacing.
- A recorded result is a non-bye match with a winner, excluding bye
  auto-advances. Use this same definition for displayed counts and server
  confirmation.
- Replace only already-drawn events with recorded results. Skip existing
  draws with no recorded results. Continue generating undrawn events through
  the current generation path, including the payment/unpaid gate. Per-category
  generation remains available only for undrawn cells.
- If no recorded results need replacement, retain the existing all-draw,
  remaining-draw, all-generated, and no-draw labels.

## Scope and safeguards

- No database schema or migration changes and no `.github` changes.
- Do not write to production or modify Copa Otoño or Invierno data. Any manual
  generation/replacement verification must use a new throwaway development
  tournament.
- Leave `redrawEvent` unchanged and do not add per-category replacement.
- Do not localize unrelated leftover English or change unrelated product copy.
- Preserve unpublished QA fixtures and drafts.

## Acceptance criteria

1. Spanish public category navigation is “Categorías”; English is “Draws”.
2. Spanish entrants title is “Inscritos · OpenTennis”; English is
   “Entrants · OpenTennis”.
3. Bulk replacement requires review and confirmation, displays affected draw
   counts, and is refused server-side when unconfirmed or stale.
4. A matching confirmation replaces only result-bearing eligible draws;
   cancellations and stale confirmations do not write. Existing zero-result
   draws remain untouched.
5. First-time generation, remainder labels, and the unpaid-entry gate continue
   to work. Single-draw `redrawEvent` remains unchanged.
6. Validate tests (with engine/db/web counts), typecheck, lint, and the web
   production build against the exact PR head SHA. If the sandbox cannot reach
   `fonts.googleapis.com`, record that the production build must run on the box.
