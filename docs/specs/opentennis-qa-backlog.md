# OpenTennis QA backlog

Accepted scope for implementing the 6 November 2026 (America/Tijuana) visual QA of `LMBraca/opentennis` at commit `670d5f869a75e6e6d4436497126fdd45922d5c88` (`670d5f8`), which is the current `main` tip. Spanish (es-MX) is the product default; English is the translation.

This file is the spec Builder must commit to `docs/specs/opentennis-qa-backlog.md` and link in every related pull request body. QA grades against it.

## Constraints

- All code writing goes through GitHub Copilot’s cloud coding agent (Copilot cloud). Do not use Cursor cloud agents. Do not write code inline.
- Work on a non-`main` branch and open a pull request. Nothing merges without Luis’s OK.
- Every push must pass the project’s full production build and tests, and the hosted preview for that exact commit must be Ready, before review.
- No production database writes. Do not delete, redraw, or clear results on Copa Otoño or Invierno. Do not change the existing owner account. Do not expose scorekeeper tokens, password hashes, or preview share tokens.
- Do not “implement” Untested tickets (OT-38–OT-49) as product features. Those are remaining QA coverage, not a build list.
- Prefer correctness over speed. Investigate the real cause; do not ship a guess.

## Goal

Make the club product match how an organizer, player, visitor, and scorekeeper actually use it: schedules respect feeder matches, rest, and stated hours; draws show every round; Spanish is complete; times are local to America/Tijuana; admin actions do not silently publish or silently truncate; leftover test content does not ship.

## Suggested pull-request batches

1. **P0 — this first PR:** OT-1, OT-6, OT-20, OT-7, OT-4, OT-2.
2. **i18n and recovery (after Design delivers copy/UX notes):** OT-3, OT-5, OT-22, plus related leftover English in OT-23 accessible labels if already in scope.
3. **Organizer and player truthfulness:** OT-8, OT-9, OT-10, OT-11, OT-12, OT-13, OT-14, OT-15, OT-16, OT-17, OT-18, OT-19, OT-21, OT-24, OT-25.
4. **Content and polish:** OT-26 through OT-37. Content cleanup only on development fixtures, never by wiping live club tournaments.

Design defines UX before UI implementation for batches 2 and 3. Database reviews scheduling, timezone display, and entry-open vs publish state. Builder implements via Copilot. QA verifies on the Ready preview. Ops confirms preview status.

---

## Batch 1 — P0 (implement now)

### OT-1 — Consolation precedes its feeder (Fail)

**Where:** Copa Otoño C+ Singles. Rivas consolation semifinal Friday 20 November 2026 08:00 on Cancha 2 vs a blank opponent, before the Round of 16 Salas vs Rivas at 10:30 on Cancha 1, which already has a result. Visible on the public path (ES and EN, phone), the match page, and the admin order of play. Times as shown to users; the club zone is America/Tijuana.

**Acceptance:**

- A consolation (or any downstream) match is not scheduled before its feeder can be complete, including player rest after that feeder.
- Byes auto-advance and do not occupy a playable court slot against a blank opponent.
- Public path, match page, and order of play stay consistent.
- Add a regression that would have caught the Rivas consolation-before-feeder case.

### OT-6 — Generated schedule loses a match and violates displayed constraints (Fail)

**Where:** Throwaway “QA Flow Test” (slug `qa-flow-test-26`): start 15 November 2026, 2 courts, 60 minute match + 60 minute rest. Weekday morning displayed as 8:00 AM–8:00 AM, evening 6:00–10:00 PM, weekend 10:00 AM–4:00 PM. UI said “15 of 15 matches across 2 courts over 2 days”; the order of play listed 14 and omitted Round 4 Six vs Test. Monday included 06:00 and 07:00 starts. Cancha 1 had 10:00 then 11:00, 06:00 then 07:00, and 20:00 then 21:00 (one-hour gaps) despite 60+60 requiring two hours if the same player or the same court rest rule applies. Cancha 2 spacing looked correct. All times America/Tijuana.

**Acceptance:**

- Every generated match appears exactly once on the order of play. Scheduler counts and order-sheet counts match.
- Zero-length windows are rejected, not treated as overnight or empty-but-valid ranges.
- Starts fall inside the windows the organizer set.
- Match duration and player rest are enforced, including for players coming from a prior dependency.
- Audit one-hour court sequences against actual player assignments (do not assume a court must sit idle for an hour if different players are involved and the product rule is player rest, not court rest). Document the intended rule in the PR.
- Fixture covering a 6-player round robin (15 matches) that asserts all 15 are listed and constraints hold.

### OT-20 — Event and scheduling defaults are surprising (Confusing; fix with OT-6)

**Where:** New Open Singles defaults to round robin. New weekday morning displayed 8:00 AM–8:00 AM instead of a disabled or blank window.

**Acceptance:**

- Format choice is explicit. If a default remains, the UI describes it; do not silently pick round robin without the organizer seeing that choice.
- Disabled or unused dayparts are visually distinct from a real equal start/end (zero-length) window.
- Saving a schedule with end not after start fails with localized feedback.

### OT-7 — UTC instants displayed as local times and dates (Fail)

**Where:** Scorekeeper link “created” displayed 23:57 on 6 November when the action was about 15:57 America/Tijuana. “Last used” displayed 00:09 on 7 November when the action was about 16:09 on 6 November. An accepted entry displayed 7 November 00:25 when acceptance was about 16:25 on 6 November. A test article dated “7 de noviembre de 2026” though written the afternoon of 6 November local time.

**Acceptance:**

- Operational timestamps and article dates format consistently in America/Tijuana.
- Show a visible zone where a lone clock time could be misread.
- Tests cover UTC-midnight boundaries and a DST transition if the formatter is zone-aware.
- Date-only tournament dates (event calendar days) stay stable and are not shifted by timezone conversion.

### OT-4 — 32-draw Final clipped on desktop (Fail)

**Where:** Copa C Singles and Invierno B at 1920×1072: headers stop at Semifinal; minimap has an empty extra column. At 390px the Final starts offscreen but is reachable by in-bracket horizontal scroll. 8-draw Open Singles already shows its Final.

**Acceptance:**

- The Final is inside layout bounds and the minimap on desktop.
- Every round is reachable on desktop and phone without page overflow.
- The working 8-draw layout and the phone in-bracket scroller do not regress.

### OT-2 — Published article links to a missing tournament (Fail)

**Where:** Published update “Finales de noviembre”, link text “los cuadros”, points to `/t/open-tennis-prueba-noviembre-26`, which 404s.

**Acceptance:**

- The article points at an intended published draw, or the broken link is removed.
- Internal tournament links are validated before publish and covered by a link-check test.
- If the article body lives in the database, change it only on the development branch. No production writes. Prefer a code-level validator so a future bad link cannot publish.

---

## Batch 2 — Localized recovery and leftover English (after Design)

### OT-3 — Missing and hidden pages use an unbranded English 404 (Fail)

Keep HTTP 404 and privacy (a hidden tournament URL must not leak the event). Render a branded es-MX recovery with home/search links and an English translation. Test desktop and phone.

### OT-5 — Spanish-first UI has English login, scoring, and bracket copy (Fail)

Shared es-MX defaults and EN translations for: `/admin/login` and failed login (“Those details did not match an account.”); invalid and revoked scoring pages (“Link not valid” / “This scoring link does not work any more…”); the entire phone scorer (“Scoring as…”, “Enter result”, “How did it end?”); public labels still in English on Spanish pages (Open Singles, Bye, Round robin, Round 1, 5 byes, 8 matches); document titles and accessible bracket controls. Test initial Spanish and EN→ES navigation.

### OT-22 — Organizer chrome mixes English and Spanish (Confusing)

Admin pages are English-only with no language toggle. The order-of-play page title is English but column headers are Spanish (Hora, Cancha, Categoría, Partido). Apply the shared es-MX/EN locale to admin chrome, actions, examples, and order-sheet titles/headers.

---

## Batch 3 — Organizer and player truthfulness (Design before UI)

### OT-8 — Match totals have no defined scope (Confusing)

Copa manage said 57 matches / 3 of 57 played; schedule, results, and order of play said 35 (15 ready + 3 recorded + 17 waiting). Public Consolación header said 7 Partidos for an 8-player draw that also has consolation. Define total, scheduled, playable, completed, and main/consolation scopes; label and reconcile them across admin, public, and order views.

### OT-9 — Generate all draws stays enabled while results exist (Confusing)

Button state verified; the click was not tested. Per-draw replacement warnings already exist. Gate bulk replacement when results exist; show affected draws/results; require explicit confirmation. Enforce the same rule server-side.

### OT-10 — Scoring URL is hard to copy and disappears after create (Confusing)

New links appear once in a selectable field with “Copy it now” but no Copy button. Existing links (for example “Mesa de control”) show no URL and no copy action. Entry-share fields already have Copy and Open. Add Copy and Open at creation with copied feedback. For existing hashed tokens, offer safe replacement/reissue rather than exposing stored secrets. Never print raw tokens in logs, tests, or PR text.

### OT-11 — Opening entries silently publishes a hidden draft (Confusing)

Opening entries on QA Flow Test moved Draft/Hidden → Published/Public without using the status controls, so the tournament could appear on the homepage. Keep stage, visibility, and entry-open independent, or require explicit confirmation that opening entries will list the tournament publicly. Test Draft/Hidden and Published/Hidden.

### OT-12 — Pending and rejected players see accepted-entry messaging (Confusing)

With review on, players still see “¡Listo! Ya estás inscrito. Paga la inscripción en recepción.” Organizer copy admits players see confirmation. Rejected “QA Player Three” remained under “Already in the draw.” Return localized pending, accepted, and rejected states. Separate organizer lists and headings. Do not promise an accepted place before review.

### OT-13 — Accepted entrants described as already in a draw before generation (Confusing)

“Entries go straight into the draw” / “Already in the draw” appeared with accepted entrants but no matches generated. Say “accepted entrants” (or equivalent) before generation; distinguish registration from generated-draw membership.

### OT-14 — Profile match count means completed, but is not labeled (Confusing)

Fernanda Ruiz: “0 Matches · 0-0 W-L” while listing an unplayed QF vs Cruz. Alejandro Beltrán: “1 Match · 0-1” with two cards (played QF and unplayed consolation final). Label completed matches, or show completed and upcoming separately. W-L counts completed results only.

### OT-15 — Player profiles omit Recorrido / Path (Confusing)

Profiles offer Partido / Match only. Draws and match pages already expose paths. Add an event-specific Recorrido / Path link for each profile tournament entry.

### OT-16 — Closed-entry introduction still instructs players to enter and pay (Confusing)

Closed `/enter` pages lead with “Elige tu categoría…” / “Pick your category and leave your details. Pay the entry fee at the desk.” then “Inscripciones cerradas.” Make closed status the lead. Suppress active-form instructions and payment prompts when closed. Keep the server-side closed-entry guard.

### OT-17 — Tournament navigation skips overview and category context (Confusing)

Home slug and “View the draws” land on the first Open Singles draw, not a hub. Provide an overview with dates, categories, and entry state. Explain disabled or unbuilt events. Offer an entry CTA only when eligible and open.

### OT-18 — Entry validation relies on an English browser tooltip (Confusing)

Empty submit showed only “Please select an item in the list.” Add localized inline field errors and a summary, focus the first invalid field, and preserve entered values.

### OT-19 — High-impact actions lack a consistent confirmation policy (Confusing)

Observed immediate revoke, update delete/publish/unpublish, hide tournament, accept/reject, and result Undo. After Undo, a blank editor stayed open with another Undo (15 ready / 0 recorded). Require confirmation for destructive or public-visibility changes and for rejection/revocation, or provide clear reversible recovery where safe. Disable Undo when nothing remains; close stale editors.

### OT-21 — Category input silently truncates at 12 characters (Confusing)

“QA Test Category” became “QA Test Cate” with no helper. Document and validate the intended limit with a counter or error instead of silent truncation. Support fuller labels if the product should allow them, while preserving stable URLs. Do not rename or delete the existing Open / A / B / C+ / C / D ladder as part of this fix.

### OT-24 — Phone score grid and floating control (Confusing)

At 390px, later sets require horizontal scroll and set 1 slides away. A floating control overlapped Enter result / Edit / Undo / Clear on public and scorekeeper pages. Fit or reflow set entry at 390px with stable labels. Keep all actions reachable above floating controls.

### OT-25 — Consolation bracket headings lose their stage prefix (Confusing)

The consolation section is labeled, but in-bracket titles are plain Semifinal / Final and placeholders repeat “Ganador de SF1.” Use unambiguous main vs consolation stage labels and distinct placeholders.

### OT-23 — Played match detail does not name the winner (Confusing)

Alvarez vs Diallo showed 6–4 6–3 and Recorrido but no finished/winner label, while the draw’s accessible name said the winner “venció a” the opponent. Show localized completed status and winner on match detail, including retirement, walkover, and default.

---

## Batch 4 — Content and polish

Content and seed cleanup applies to development fixtures only. Do not delete Copa Otoño or Invierno or their real entrants.

### OT-26 — Test tournament featured as a live club event (Contrived)

Consolación 27901 appears under “En curso” with no test label. Hide or explicitly mark fixtures and exclude them from normal public listings. Use a documented seed/demo policy. Do not delete it if that would destroy QA history unless Luis later asks; hiding or un-featuring is enough.

### OT-27 — Test-style entrants in public directory and draws (Contrived)

Names such as Uno1, Turnstile, and long numeric IDs appear in public draws and the directory. Separate test fixtures from launch content. Replace or remove only confirmed fixture records through supported admin or data migrations on development, preserving real tournament history.

### OT-28 — Published story and gallery are mismatched fixtures (Contrived)

“Finales de noviembre” includes the escaped string `<script>alert('xss')</script>` (not executed), a football-stadium hero, and gallery images (kayak / grass / fjord) captioned for example “Semifinal C+.” English lightbox chrome over a Spanish title. Keep HTML escaping. Remove test residue. Localize gallery chrome. Change article bodies only on development.

### OT-29 — Live Riverside style-guide demo on production (Contrived)

`/style-guide` returns HTTP 200 on production and preview. Exclude or access-gate internal design demos on production.

### OT-30 — One-draw pluralization (Polish)

Dashboard says “1 draws”; Categories says “1 draw.” Use locale plural rules for 0, 1, and 2+.

### OT-31 — Decide whether English retains “Cancha” (Polish)

English match/player/path pages show “Cancha 1/2.” This may be intentional club terminology. Record the decision: keep “Cancha” in English or translate to “Court” consistently. Keep es-MX as “Cancha,” not “pista.”

### OT-32 — Round-robin labels use only the last word of a name (Polish)

“QA Player Test” displayed as “Test.” Define a display-name policy. Expose full names accessibly and on detail. Disambiguate identical final words.

### OT-33 — Inconsistent locale refresh (Polish)

Earlier desktop EN→ES on a C+ draw stayed English until navigation; later phone EN→ES worked. Not a permanent verified failure. Add locale-switch coverage so translated data updates without a manual reload. Reproduce before changing refresh behavior.

### OT-34 — Footer, excerpts, blurbs, lightbox layering (Polish)

Footer “AF Pro Shop on Instagram”; some excerpts use “pista”; Invierno has an English unseeded-draw blurb on the Spanish site. Lightbox left footer credit visible over the overlay (observed once). Apply approved es-MX copy. Contain lightbox layering.

### OT-35 — Latest-news cards inconsistently paint (Polish)

Earlier homepage shots showed blank “Lo más reciente” cards; a later shot showed excerpts. Reproduce with cold load, hydration, and reduced motion before treating as fixed.

### OT-36 — Inner-page logos and navigation (Polish)

Some production inner pages showed a blank logo slot; home and later phone search painted the logo. Verify asset loading and accessible home navigation across routes.

### OT-37 — Measure small navigation/footer contrast (Polish)

Green/grey bands looked small or low-contrast in desktop screenshots; no measurement was taken. Measure against accessibility contrast standards and adjust only failing styles.

---

## Out of scope for implementation (Untested coverage)

Do not build speculative features for these. QA will exercise them later on disposable development data: player merge and undo (OT-38); owner-only delete and redraw (OT-39); category add/rename/reorder/delete of a new short-named row (OT-40); CSV import (OT-41); seeds, slot swaps, format changes, third-place playoff (OT-42); non-zero fee and Stripe test-mode checkout (OT-43); re-entry after rejection (OT-44); Clear vs Undo (OT-45); clicking Generate all draws with existing results (OT-46, after OT-9 lands); keyboard search and bracket focus (OT-47); remaining organizer configuration (OT-48); live delivery without reload and print/QR/export artifacts (OT-49).

## What already works (do not regress)

- Public site defaults to Spanish; scheduled matches say Cancha.
- Closed entry is enforced; open zero-fee entry accepts name, email, phone, and category and shows “¡Listo! Ya estás inscrito. Paga la inscripción en recepción.” with no Stripe when the fee is 0.
- Accent-insensitive search (Beltr / Beltrán).
- Scorekeeper can record Played, Retired, Walkover, and Default. A recorded score updates the public draw, match page, and Recorrido, including consolation placement. Revoking a link immediately invalidates it.
- Admin result save and Undo work. Per-draw replacement already warns when results exist. Empty-draw delete asks for the draw name. A non-owner admin has no Delete tournament control.
- Hiding a tournament removes it from the homepage (the direct URL 404s; the 404 page itself is OT-3).
- Updates CMS create, publish, unpublish, and delete work (confirmations are OT-19).
- Organizer accept/reject works (player-facing copy is OT-12).
- Logout returns to `/admin/login` (the form language is OT-5).
- Generating a 6-player round robin produced 15 matches.
- 8-draw Open Singles shows the Final column.

## PR checklist

- [ ] `docs/specs/opentennis-qa-backlog.md` committed and linked in the pull request body.
- [ ] Full production build and tests pass on every push.
- [ ] Hosted preview for that exact commit is Ready before anyone reviews.
- [ ] No production database writes; no Copa/Invierno destructive changes; no secrets in the PR.
- [ ] Nothing merged until Luis says so.
