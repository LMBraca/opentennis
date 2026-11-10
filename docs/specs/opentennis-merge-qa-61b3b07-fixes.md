# OpenTennis merge-QA fixes — D1–D5 on `61b3b07`

**Date:** Monday, 9 November 2026, ~7:50 PM PT (America/Los_Angeles)  
**Repo:** https://github.com/LMBraca/opentennis  
**Base only this SHA:** `61b3b078b08fe8b080be7aef4e24057a97a14dbc` (`main` and `prod-readiness` both tip here; no open PRs)  
**Repo path for this spec:** `docs/specs/opentennis-merge-qa-61b3b07-fixes.md` (add this file with exactly the content below and link it in the PR body)

Branch from current `main` `61b3b07`. Do not branch from stale `copilot/*` or `batch3-organizer-truthfulness` tips. Do not start if `main` or `prod-readiness` has moved past this SHA, or if another implementation PR is already open.

## Out of scope

- Do **not** restore Copilot’s bulk draw-replacement controls in `admin-grid.tsx` in this PR. That known loss is confirmed and tracked separately (Claude offered to re-apply it). Do not rewrite `admin-grid.tsx` wholesale to bring those controls back.
- Do **not** translate all 21 ADMIN-I18N admin files. Only the three surfaces photographed below (blog editor/list, draw-sheets chrome, C+ Singles entrants) plus the RV-12 framing.
- Do not implement OT-38–OT-49. Do not measure OT-37.
- No production database writes. Do not delete, redraw, clear results, generate/replace, hide, or run `saveAndSchedule` on Copa Otoño or Invierno. Do not rewrite their player names. Do not SQL-update Copa match ids `10a44b5f-0443-44e9-8449-fe981be855c9` or `18faadb1-a3be-42c2-8aff-369fd8d5c740`.
- Leave unpublished QA leftovers alone: blog draft `/blog/qa-draft-61b3b07-do-not-publish` and tournament `qa-61b3b07-throwaway` (Borrador). Prefer a fresh unpublished throwaway if the wizard must be exercised.

## D1 — OT-27 directory filter (merge regression) — highest priority

**Where:** public `/search?q=Prueba` and `/search?q=1793` on the development-backed preview.

**Expected (as on PR #8 head `9c99746`):** those fixture first/last-name tokens stay out of the public directory. Search should read empty / “Nadie con ese nombre.” Direct `/p/…` URLs are not filtered. Stored matches stay; do not SQL-delete players or regenerate Copa/Invierno.

**Actual:** “Prueba” lists Dos2534, Dos2541, Tres8, Turnstile, and Uno1–Uno5 (each “Nombre, Prueba”). “1793” lists `17939888018740`, `17939888058831`, `17939888098472`, `17939888138213`, and `17939888178244` (each “…, Lleno”). Invierno B still shows italic “Por definir” in the leftover slot (Mateo Nava vs that slot), so the draw-label filter held and the directory filter did not.

**Evidence:** `shots/ot27-directory-prueba-desktop-es.png`, `shots/ot27-directory-1793-desktop-es.png`, `shots/ot34-invierno-b-desktop-es-lower.png`.

**Fix:** restore the public search/directory omission that shipped in batch 4. Keep the working draw-label filter. This is a display filter (exact first/last-name tokens omitted from search), not a data delete.

## D2 — English admin chrome under Spanish locale

**Where (photographed, ES selected):**
- Admin blog editor/list: “New update”, “Edit update”, “Back to updates”, Title, Summary, Body, “Upload image”, “Cover image”, “Save update”
- Draw sheets (`/print`): “Draw sheets”, “One sheet per draw, each on its own page. Print in landscape.”, “6 sheets” (the “Imprimir hojas” button is already Spanish)
- C+ Singles entrants: Seed / Name / Contact / Paid, “Save seeds”, “Import a CSV”, “Add entrants manually”, “Play a third-place playoff in this draw”, “Scoring”, and the “Type 1 and 2 to keep your two strongest apart…” hint

**Expected:** Spanish default except intentional English (Open, Singles, Bye/byes, RET/W/O/DEF, Walkover, Default, Set N, tb, admin “Round robin”). No raw dictionary key names.

**Evidence:** `admin/shots/rv15-blog-editor-desktop-es.png`, `admin/shots/rv10-draw-sheets-desktop-es.png`, `admin/shots/rv12-placement-desktop-es.png`.

**Fix:** put these strings through both locale dictionaries (es-MX and EN). Do not restore keys Claude deleted on purpose (`allUpdates`, `consolationLead`, `pathTitle`, `viewPath`, `signedInAs`) unless a visible screen actually needs them.

## D3 — RV-18 scores Draw view layout and toggle

**Where:** `/admin/copa-otono-open-tennis-26/scores?view=draw` and the list/draw control on `?view=list`.

**Expected:** Matches grouped in bracket order (Open before C; C+ must not sort above Open). List and draw share the same row editor, Clear, and Undo rules (Deshacer only when `status === complete` / registered completed matches — already correct on this SHA). A usable styled toggle between Lista and Cuadro, not concatenated unstyled text. Columns must not stack Open Cuartos under the “Final de consolación” heading. At phone width, columns should not clip a later round (Semifinal) off-screen without a way to reach it.

**Actual:** Toggle renders as unstyled blue text “ListaCuadro”. Open “Final de consolación” column also stacks both Cuartos (Villarreal/Beltrán 6-3 6-4 and Esquivel/Palacios 7-5 6-2). Phone-width capture clips the Semifinal column.

**Evidence:** `admin/shots/ot19-copa-scores-draw-desktop-es.png`, `admin/shots/ot19-copa-scores-list-desktop-es.png`, `admin/shots/ot19-copa-scores-draw-phone-es.png`.

**Fix:** restyle the toggle as two distinct controls (Lista | Cuadro) that update `?view=`. Put each round in its own column so Cuartos are not nested under consolation final. Do not change OT-19 undo visibility. Inspect only on Copa; do not click Deshacer / Anotar / Editar / Borrar / generate on Copa or Invierno.

## D4 — RV-12 placement framed as “Separate two players”

**Where:** Copa C+ Singles entrants / seed UI.

**Expected:** Placement framed as “Separate two players” (or Spanish equivalent, e.g. “Separar a dos jugadores”) with a situation-first hint. Seed number inputs may remain if that is how separation is expressed, but the control and hint must match the framing and be in the active locale.

**Actual:** Seed inputs plus English “Type 1 and 2 to keep your two strongest apart until the final…”. No “Separate two players” control.

**Evidence:** `admin/shots/rv12-placement-desktop-es.png`.

**Fix:** copy and framing only on this pass unless the control itself is missing (not just unlabeled). Do not save seed changes on Copa.

## D5 — RV-17 setup landing

**Where:** creating a tournament lands on `/admin/:slug/setup/draws`; also the new tournament’s `/admin/:slug` page.

**Expected:** Create lands on setup/draws with a stepper over a real draft, Skip available, and a shrunken day-of nav (entries, scores, order of play, scorekeepers, QR, draw sheets, plus Configuración). An empty grid must not claim every draw is already generated.

**Actual:** Landing and Skip work on `qa-61b3b07-throwaway`, but the empty grid says “Todos los cuadros están generados.” The new tournament admin page had no day-of nav. `Siguiente` goes to `/schedule?setup=1`; the landing URL itself may omit `?setup=1`.

**Evidence:** `admin/shots/rv17-setup-draws-desktop-es.png`.

**Fix:** empty / ungenerated state copy must be truthful. Day-of nav links must appear on the new tournament admin page. Exercise only on a throwaway draft; leave it unpublished (Borrador). Do not publish it or make it look like Copa/Invierno.

## Already passing — do not regress

RV-16 image upload and RV-15 editor save/reload (formatting survived) passed on unpublished draft `/blog/qa-draft-61b3b07-do-not-publish`. OT-19 Deshacer only on the two registered Copa matches, OT-26, OT-28, OT-31 Cancha, RV-4 Recorrido removal, RV-5 `/admin/categories` 404, RV-6 Copa hub redirect to first draw, `isBye` filtering, and RV-1 admin “Round robin” passed. Keep those.

## Gates

Record on the exact PR head, in the PR body: `pnpm -r test` with engine / db / web counts, typecheck, lint, and `pnpm build`. Hosted preview of that exact commit must be Ready before QA. Claude claimed 843 tests (413 engine / 73 db / 357 web) on `61b3b07`; say if the count changes and why.
