# OpenTennis QA — UX notes and es-MX copy

**For:** batches 2 and 3 of `docs/specs/opentennis-qa-backlog.md` (OT-3, OT-5, OT-22, then OT-8–OT-21, OT-23–OT-25).  
**Date:** 6 November 2026, America/Tijuana  
**Against:** `LMBraca/opentennis` @ `670d5f869a75e6e6d4436497126fdd45922d5c88` (`670d5f8`)  
**Voice source:** `apps/web/lib/i18n/dictionaries.ts` (existing public Spanish) and `docs/design-system.md`

Builder should add every new string as a **plain dictionary key** (no functions — the object is passed to client components). Spanish is the product default; English is the translation. Use `intlLocale`: `es-MX` / `en-GB`. Substitute placeholders with the existing `fill()` helper (`{name}`, `{n}`, `{label}`, `{round}`, `{winner}`, `{loser}`).

Do not implement Untested tickets (OT-38–OT-49). Do not rename or delete the Open / A / B / C+ / C / D ladder.

---

## Voice and terminology

Follow the tone already in the public dictionary: short, spoken Mexican club Spanish, ustedes (not vosotros), no marketing filler.

| Concept | es-MX | en |
|---|---|---|
| Court (noun / column header) | Cancha | Cancha |
| Numbered club courts | Cancha 1, Cancha 2 | Cancha 1, Cancha 2 |
| Never | pista | — |
| Singles / Doubles | Singles / Dobles | Singles / Doubles |
| Bye (loanword, already decided) | Bye / bye / byes | Bye / bye / byes |
| Draw (the bracket) | cuadro | draw |
| Category (a published event) | categoría | draw / category (existing `draw` → “Categoría”) |
| Round robin | Todos contra todos | Round robin |
| Path | Recorrido | Path |
| Enter | Inscripción / Inscribirme | Enter |
| Wins–losses | G-P | W-L |
| Live | En vivo | Live |

**OT-31 — recommendation:** keep **“Cancha” in English as club terminology.** Do not translate it to “Court.” es-MX stays “Cancha,” never “pista.” See the OT-31 section below.

**Intentional “English” on Spanish pages (do not “fix”):** Singles; Bye / byes; category codes Open, A, B, C+, C, D; scoring abbreviations RET, W/O, DEF and the words Walkover and Default; Set N; the `tb` tiebreak placeholder.

**Document titles** use the page’s localized name: `{title} · OpenTennis`, or `{title} · {tournament} · OpenTennis`. Stop shipping `Enter ·`, `Path ·`, `Sign in ·`, `Order of play ·`, `Scores`, `404: This page could not be found.`

**Admin locale:** the organizer uses the same locale cookie and the same language control as the public site (default Spanish). There is no English-only admin chrome.

---

## OT-3 — Branded 404 (Fail)

### UX

- Keep **HTTP 404**. Hidden or unpublished tournament URLs must 404 the same way as a typo — do not reveal that a slug exists, and never print the tournament name, dates, or “this event is hidden.”
- Replace the stock Next.js English fallback (`This page could not be found.`) with a **branded recovery that uses the public header, footer, and page rule**. Left-aligned on the content edge; not a centered system-ui stack; not a blank `__next_error__` page.
- Same layout at desktop and ~390: logo home link, short title, one sentence, two text actions. No extra illustration.
- `html lang` follows the active locale (`es` / `en` as today, formatted as es-MX / en-GB). `noindex` may stay.
- Actions: **Inicio / Home** (`/`) and **Buscar un jugador / Find a player** (`/search`). Optional third link to `/` tournament list is unnecessary if the header already has Torneos.
- Invalid **player** and **broken article** URLs use this same page. Invalid **scoring** links are OT-5 (different copy, same privacy idea: a bad token and a revoked token look identical — already true in `app/score/[token]/page.tsx`).

### Type

The title lives in the public header band in the display face (Archivo), same as an article title — that contrast with the body is intended. The body sentence and the two actions sit on the page rule below in Instrument Sans at `body` (15 / 22, weight 400) using `--ink-900`, with the usual text-link style (same as footer and article links). Do not render that sentence or those actions in a fallback face or `--ink-300`.

### Copy

| Key | es-MX | en |
|---|---|---|
| `notFoundTitle` (H1 and document title stem) | No encontramos esta página | We couldn’t find this page |
| `notFoundBody` | Es posible que el enlace esté mal escrito o que esta página ya no esté publicada. | The link may be mistyped, or this page is no longer published. |
| `notFoundHome` | Ir al inicio | Go to the home page |
| `notFoundSearch` | Buscar un jugador | Find a player |
| Document title | No encontramos esta página · OpenTennis | We couldn’t find this page · OpenTennis |

Do not write “el torneo no existe,” “este torneo está oculto,” or anything that distinguishes missing from hidden.

---

## OT-5 — Spanish-first leftovers (Fail)

Move hardcoded English in login, scoring, score entry, public chrome, document titles, and bracket accessibility into the shared dictionary. Test a first visit in Spanish and an EN→ES navigation (copy must update without a leftover English island).

Existing keys already cover many public words (`roundRobin`, `bye`, `drawByesN`, `matches`, `pathTitle`, `enterTitle`, `email`, …). Wire those through; do not invent parallel wording.

### Login (`/admin/login` and failed submit)

Current source is hardcoded in `login-form.tsx` and `admin/actions.ts`.

| Key | es-MX | en |
|---|---|---|
| `adminEyebrow` | Administración | Admin |
| `signIn` | Iniciar sesión | Sign in |
| `signingIn` | Entrando… | Signing in… |
| `password` | Contraseña | Password |
| `loginNeedBoth` | Escribe tu correo y tu contraseña. | Enter your email and password. |
| `loginMismatch` | Esos datos no coinciden con ninguna cuenta. | Those details did not match an account. |

Reuse `dict.email` (“Correo electrónico” / “Email”). Keep one mismatch message for unknown account **and** wrong password (do not enumerate accounts). Visible heading can stay the club name “Open Tennis” plus `adminEyebrow`. Document title: `Iniciar sesión · OpenTennis` / `Sign in · OpenTennis`.

### Invalid or revoked scoring link

Same page for wrong, revoked, and expired tokens (do not split those states visually).

| Key | es-MX | en |
|---|---|---|
| `scoreLinkInvalid` | Enlace no válido | Link not valid |
| `scoreLinkInvalidBody` | Este enlace de marcador ya no funciona. Pide uno nuevo al organizador. | This scoring link does not work any more. Ask the organizer for a new one. |

Document title: `Enlace no válido · OpenTennis` / `Link not valid · OpenTennis`. Prefer the public/tool header (logo) so this is clearly the club, not a raw 404. HTTP status may stay 200 if that avoids leaking existence; the copy must not distinguish “never issued” from “revoked.”

### Phone scorekeeper and shared `ScoreList`

`app/score/[token]/page.tsx` and `admin/.../scores/score-list.tsx` share one UI. Localize all of it (this is also OT-22).

| Key | es-MX | en |
|---|---|---|
| `scoringAs` | Anotando como {label}. | Scoring as {label}. |
| `scoresTitle` | Marcador | Scores |
| `readyToScore` | Listos para anotar | Ready to score |
| `recorded` | Registrados | Recorded |
| `waitingEarlier` | En espera de un resultado anterior | Waiting on an earlier result |
| `readyToScoreEmpty` | No hay ningún partido listo para anotar. Genera un cuadro, o registra un resultado para abrir la siguiente ronda. | Nothing is waiting for a score. Generate a draw, or record a result to open the next round. |
| `waitingOnResult` | En espera de un resultado | Waiting on a result |
| `enterResult` | Anotar resultado | Enter result |
| `editResult` | Editar | Edit |
| `closeResult` | Cerrar | Close |
| `howDidItEnd` | ¿Cómo terminó? | How did it end? |
| `outcomePlayed` | Jugado | Played |
| `outcomeRetired` | Retiro | Retired |
| `outcomeWalkover` | Walkover | Walkover |
| `outcomeDefault` | Default | Default |
| `whoCarriedOn` | ¿Quién siguió? | Who carried on? |
| `whoAwarded` | ¿A quién se le otorga el partido? | Who was awarded the match? |
| `setN` | Set {n} | Set {n} |
| `saveResult` | Guardar resultado | Save result |
| `saving` | Guardando… | Saving… |
| `cancel` | Cancelar | Cancel |
| `undo` | Deshacer | Undo |
| `undoing` | Deshaciendo… | Undoing… |
| `clearResult` | Borrar | Clear |
| `clearing` | Borrando… | Clearing… |
| `gamesAria` | Juegos de {name}, set {n} | {name} games, set {n} |
| `tiebreakAria` | Puntos de tiebreak de {name}, set {n} | {name} tiebreak points, set {n} |

Header facts on the scorekeeper page: `{n}` + `readyToScore` / `recorded` (lowercase in English facts is fine; Spanish labels stay as in the table). Tiebreak field placeholder stays `tb`.

### Public labels still rendering English on `lang=es`

| Symptom at 670d5f8 | Required |
|---|---|
| “Round robin” | Use existing `roundRobin` → “Todos contra todos” |
| “Round 1” (round robin) | Add `roundIndexed`: “Ronda {n}” / “Round {n}” |
| “8 matches” / “1 match” / “16 matches” | Add `matchCount1` “1 partido” / “1 match”; `matchCountN` “{n} partidos” / “{n} matches” |
| “5 byes.” / “1 bye” | Keep existing `drawBye1` / `drawByesN` (“1 bye” / “{n} byes”) — intentional loanword |
| “Bye” in a bracket cell | Keep existing `bye` |
| “Open Singles” | Category code + existing `singles` (“Singles” in both) — correct |
| Document titles `Path ·` / `Enter ·` / `Tournament ·` | Use `pathTitle`, `enterTitle`, `tournament` |

### Bracket accessibility (OT-5 + leftover OT-23 labels)

| Key | es-MX | en |
|---|---|---|
| `drawKeyboardHint` | Cuadro. Usa las flechas para moverte entre partidos. | Draw. Use the arrow keys to move between matches. |
| `zoomOut` | Alejar | Zoom out |
| `zoomIn` | Acercar | Zoom in |

Screen-reader match sentences should keep using `versus`, `defeated`, `beatWithOutcome`, `seedNumber`, and `receivesBye` (already localized). Visible match-detail winner copy is OT-23 below.

---

## OT-22 — Organizer chrome (Confusing)

Admin pages have no language toggle today and mix an English page title with Spanish column headers (`Hora`, `Cancha`, `Categoría`, `Partido` already come from the public dictionary).

### UX

- Put the **same language control** in the admin/tool chrome as the public header. Changing it updates admin copy immediately (same cookie).
- Every visible admin string — nav, page titles, leads, buttons, empty states, examples, document titles, scorekeeper reuse — goes through the dictionary.
- Order-of-play sheet is read by players on a clubhouse wall: title, lead, facts, empty state, and the “still unscheduled” warning must follow the table language, not stay English above Spanish headers.

### Order of play (`admin/[slug]/order`)

| Key | es-MX | en |
|---|---|---|
| `orderOfPlay` | Orden de juego | Order of play |
| `orderOfPlayLead` | Imprime esto para el muro del club. Vuelve a imprimirlo cuando cambien los horarios. | Print this for the clubhouse wall. Reprint it when times change. |
| `orderOfPlayEmptyLead` | Todavía no hay ningún partido con horario. Define los horarios de las canchas en la página de programación y luego programa los cuadros. | No match has been given a time yet. Set Cancha hours on the schedule page, then schedule the draws. |
| `nothingScheduled` | No hay nada programado. | Nothing scheduled. |
| `notScheduled` | sin horario | not scheduled |
| `unscheduled1` | Todavía hay 1 partido sin horario y no aparece en esta lista. | 1 match is still without a time and is not listed here. |
| `unscheduledN` | Todavía hay {n} partidos sin horario y no aparecen en esta lista. | {n} matches are still without a time and are not listed here. |

Document title: `Orden de juego · Administración` / `Order of play · Admin`. Columns already use `time`, `court`, `draw`, `match`.

Localize other hardcoded admin islands the same way as they are touched (dashboard “1 draws” is OT-30; do not invent a new plural system — use `draw` / `draws` and the `matchCount*` keys above). Examples and placeholders in create-tournament / schedule forms must not remain English when the UI is Spanish (see OT-20 in batch 1 for zero-length windows; batch 2 only owns the words).

---

## OT-31 — “Cancha” in English (recommendation)

**Keep “Cancha” in English as club terminology.** Do not translate it to “Court.”

The numbered courts are spoken and written as Cancha 1 and Cancha 2 at the club. English match, player, path, and order-of-play pages already show those stored names. Translating only the column header or the generic noun to “Court” would split one surface (“Court” above “Cancha 1”) and would not match what an organizer says out loud.

- Change English `dict.court` from `Court` to `Cancha`. Plural: `Canchas` when a count needs a noun (“2 Canchas”).
- Do not rename stored court records, and do not invent “Court 1.”
- es-MX stays **Cancha**, never **pista**.
- This is a recorded product decision for batch 4 / any earlier touch of court words. Batch 2 should follow it so login and order-of-play work does not ship a mixed header.

---

## Batch 3 — Organizer and player truthfulness

Implement these after batch 2 copy is in the dictionary. Layout follows `docs/design-system.md` (page rule, two radii, no centered card, phone category list not a sideways table, courtside score targets ≥56px in the thumb zone).

### OT-8 — Match totals have a defined scope

Five labeled scopes. The same scope must show the same number on admin, public draw headers, schedule, results, and order of play.

| Scope | Counts | Label es-MX | Label en |
|---|---|---|---|
| Total (playable) | Every match that can produce a result, **excluding byes** | Partidos | Matches |
| Main | Playable matches in the main draw | Cuadro principal | Main draw |
| Consolation | Playable matches in consolation | Consolación | Consolation |
| Scheduled | Has a start time | Con horario | Scheduled |
| Ready / playable | Both sides named, not complete | Listos para anotar | Ready to score |
| Waiting | Incomplete, at least one side unnamed | En espera | Waiting |
| Completed / recorded | Has a recorded result | Jugados | Completed |

**Rules**

- A bye is not a partido. It must not occupy a playable row or inflate “Partidos.”
- Ready + waiting + completed = total (within the stage being viewed).
- If a header shows only main-draw matches, say so: “15 partidos · cuadro principal” / “15 matches · main draw”. Never show unlabeled “57” next to unlabeled “35.”
- Public consolation section header uses the consolation count, not the main count, and not the node count that includes byes.
- Admin facts reuse `readyToScore`, `recorded`, and `waitingEarlier`.

### OT-9 — Generate all draws while results exist

- If any selected draw already has a result, the bulk control is not a silent click. Disable the immediate action and open a confirmation.
- The dialog lists each affected draw and how many recorded results it would replace.
- Confirm label: **Generar de nuevo** / **Generate again**. Secondary: **Cancelar** / **Cancel**.
- Helper: “Se reemplazarán {n} resultados en {draws}. Esta acción no se puede deshacer desde aquí.” / “This will replace {n} results in {draws}. This cannot be undone from here.”
- Enforce the same gate on the server. Keep the existing per-draw replacement warning and match its seriousness.

### OT-10 — Scoring URL copy and reissue

- At creation, show the URL once in a selectable field, with **Copiar** / **Copy** and **Abrir** / **Open**, same pattern as entry-share. After a successful copy: **Copiado** / **Copied** (announce with `role="status"`).
- Keep that new URL visible on the row until the organizer leaves the page.
- For an existing hashed link (for example “Mesa de control”), do **not** reveal the stored token. Offer **Reemplazar enlace** / **Replace link**: confirm that the old link stops working, then show the new URL once with Copy and Open.
- Confirm replace: “El enlace actual dejará de funcionar en cuanto se cree el nuevo.” / “The current link will stop working as soon as the new one is created.”
- Never print raw tokens in logs, tests, or PR text.

### OT-11 — Opening entries must not silently publish

Keep **stage** (draft / published), **visibility** (hidden / public), and **entries** (closed / open) as independent controls.

Opening entries must not change visibility or put a hidden draft on the homepage. The organizer publishes or unhides with the existing status controls.

If code cannot yet separate them, block on an explicit confirmation before any visibility change: “Abrir inscripciones también publicará este torneo en la página de inicio.” / “Opening entries will also list this tournament on the home page.” Prefer independence over that dialog.

Test Draft + Hidden and Published + Hidden: opening entries leaves the tournament unlisted until visibility is public.

### OT-12 — Pending, accepted, rejected

Players never see accepted-entry copy until the organizer accepts them.

| State | es-MX | en |
|---|---|---|
| Pending (player) | Recibimos tu inscripción. El organizador la está revisando. | We have your entry. The organizer is reviewing it. |
| Accepted (player) | Keep existing `youreIn` + `enteredSingles` / `enteredDoubles` (pay-at-desk only after accept) | same existing keys |
| Rejected (player) | Tu inscripción no fue aceptada en esta categoría. | Your entry was not accepted in this draw. |

Organizer headings: **Pendientes** / **Pending**, **Aceptados** / **Accepted**, **Rechazados** / **Rejected**. Do not file pending or rejected people under “Already in the draw.” Do not promise a place in the cuadro before review, and do not ask a pending or rejected player to pay.

### OT-13 — Accepted is not “in the draw”

| When | es-MX | en |
|---|---|---|
| Entries accepted, draw not generated | Inscritos aceptados | Accepted entrants |
| Draw generated, player placed | En el cuadro | In the draw |

Replace “Entries go straight into the draw” / “Already in the draw” before generation with: “Los inscritos aceptados aparecerán en el cuadro cuando se genere.” / “Accepted entrants will appear in the draw once it is generated.”

### OT-14 — Profile match count

The header count is **completed matches only**, and it must say so.

- Header: `{n} partidos jugados · {w}-{l} G-P` / `{n} completed matches · {w}-{l} W-L` (use `matchCount*` plus `completedMatches`: “partidos jugados” / “completed matches”).
- W-L counts completed results only.
- List upcoming matches in a separate **Próximos** / **Upcoming** group (Ruiz’s QF vs Cruz; Beltrán’s consolation final). Do not increment the header when the card is “Aún no se juega.”

### OT-15 — Recorrido on profiles

On each tournament block of `/p/…`, show **Recorrido** / **Path** next to **Partido** / **Match**, linking to the same event-specific path already used from the draw and match pages (`viewPath` / `pathTitle`). If the player has no path yet, omit the link rather than showing a dead control.

### OT-16 — Closed entry leads with closed

When entries are closed:

1. Title becomes `entriesClosed` (“Inscripciones cerradas” / “Entries are closed”) — not `enterTitle`.
2. Do not render `enterSub` (“Elige tu categoría…” / “Pick your category…”).
3. Do not mention paying at the desk.
4. Keep `entriesClosedBody` and `viewDraws`. After OT-17, `viewDraws` goes to the tournament overview, not the first singles draw.

When entries are open, keep the current `enterTitle` + `enterSub` + form. Document title always follows the visible title.

### OT-17 — Tournament overview

`/t/{slug}` is a hub, not a silent jump to the first Open Singles draw.

**Desktop and phone both show:** tournament name, date range, venue/court count if known, entry state, then the category grid from the design system.

- Each cell: category, discipline, format, entrant count, status.
- Not generated: existing `notGenerated` (“Esta categoría todavía no se ha generado.”).
- Not held: existing `notHeld` (“No disputado” / “Not held”) at reduced opacity, not a dead chip with no explanation.
- Empty (never offered): blank cell, visually distinct from “not held.”
- **Inscribirme** / **Enter** only when that visitor is eligible and entries are open.
- Phone: vertical list grouped by category (singles and doubles as two rows). Do not use a horizontally scrolling table for this navigation.
- Home cards and “Ver las categorías” / “View the draws” land here.

### OT-18 — Localized entry validation

Do not rely on the browser’s “Please select an item in the list.”

- On submit, show a short summary and inline errors already defined (`entryNeedName`, `entryNeedEmail`, `entryNeedPhone`, `entryNeedDraw`, `entryNeedPartner`, …).
- Summary: `formErrorSummary1` “Revisa 1 campo.” / “Check 1 field.”; `formErrorSummaryN` “Revisa {n} campos.” / “Check {n} fields.”
- Focus the first invalid field. Keep every value the player already typed.
- Errors sit under the field with the design-system fault treatment (ink in `--fault-500`, 2px left rule). Validate on blur, not on each keystroke.

### OT-19 — Confirmation policy

**Ask for confirmation** before: revoking a scoring link, replacing a scoring link (OT-10), deleting / publishing / unpublishing an update, hiding a tournament, rejecting an entry, clearing a recorded result, and bulk-generating draws that have results (OT-9).

**No extra confirm** for a single-step Undo, accept, or a clearly reversible edit — but:

- Disable **Deshacer** when nothing remains to undo.
- Close the result editor after a successful undo or clear; do not leave a blank editor that still offers Undo.
- Confirm buttons use the action verb (“Ocultar torneo”, “Revocar enlace”, “Borrar resultado”). Destructive confirms use the danger style. Always offer Cancelar.

Dialog frame: title = the action; body = the consequence the organizer cannot see from the button alone.

### OT-21 — Category label limit

Do not silently truncate.

- Keep the Open / A / B / C+ / C / D ladder untouched.
- Allow a longer **display** label (40 characters) with a live counter `{used}/{max}` under the field. Helper: “Así se verá en el cuadro.” / “This is how it will appear on the draw.”
- If the player hits the limit, block the extra character and show: “El nombre no puede pasar de {max} caracteres.” / “The name can’t be more than {max} characters.”
- Slugs stay separate and stable; renaming the visible label must not change existing URLs.

### OT-23 — Match detail names the winner

On a completed match page, above or beside the score:

| Outcome | es-MX | en |
|---|---|---|
| Played | Finalizado · {winner} venció a {loser} | Finished · {winner} defeated {loser} |
| Retirement | Finalizado · {winner} ganó (retiro) a {loser} | Finished · {winner} beat (retired) {loser} |
| Walkover | Finalizado · {winner} ganó (walkover) a {loser} | Finished · {winner} beat (walkover) {loser} |
| Default | Finalizado · {winner} ganó (default) a {loser} | Finished · {winner} beat (default) {loser} |

Unplayed stays `notPlayed` (“Aún no se juega” / “Not played yet”). Reuse `defeated` / `beatWithOutcome` where they fit so the visible sentence and the accessible name agree.

### OT-24 — Phone score grid and floating control

At ~390 CSS px:

- Do not keep later sets only in a horizontal scroller that slides set 1 away. Follow the design system: **one set per screen, swipe to the next**, or stack sets vertically so every set label stays on screen.
- Game entry uses steppers at least 56×56px in the lower thumb zone (no bare text fields for games). Tiebreak digits may use the numeric keypad.
- Match identity (both names + round) stays pinned at the top.
- Any floating live/control chrome must sit in a reserved bottom safe area. **Anotar resultado / Editar / Deshacer / Borrar** stay fully tappable above it on public match pages and on the scorekeeper list.
- Reduced-motion: no swipe animation required; stacked sets are an acceptable fallback.

### OT-25 — Consolation headings keep their stage

- Bracket column titles use the existing `roundConsolation` template: “{round} de consolación” / “Consolation {round}” (Semifinal de consolación, Final de consolación). Do not show a bare “Semifinal” / “Final” under “Cuadro de consolación.”
- Placeholders must not reuse main-draw ids: `winnerOfConsolation` “Ganador de cons. {match}” / “Winner of cons. {match}” (so “Ganador de cons. SF1” ≠ “Ganador de SF1”). Same for `loserOf` if consolation ever sources a loser.
- Match, path, and player cards already prefix the stage — keep those; this ticket is the in-bracket titles and placeholders.

---

## QA notes (for the Ready preview of batches 2–3)

- First load in Spanish with no cookie: login, 404 (`/t/does-not-exist` and `/p/does-not-exist`), invalid `/score/…`, a draw, and admin order of play are fully Spanish.
- Hidden tournament URL 404s without leaking the event, desktop and phone.
- EN→ES on a draw updates round lists, match counts, titles, and assistive zoom/keyboard strings.
- Closed enter leads with closed copy and no payment sentence.
- Profile header “partidos jugados” does not count an unplayed card.
- `/t/{slug}` is an overview; disabled categories explain themselves.
- Scorekeeper actions remain reachable at 390 above any floating control.
