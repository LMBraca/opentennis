# OpenTennis — production readiness

**What this is:** everything between here and running a real tournament at Open
Tennis on www.opentennis.mx. The feature backlog is finished and archived at
`docs/archive/BACKLOG.md`; this replaces it.

**Verified today, 2026-11-08**, on `batch3-organizer-truthfulness` @ `68b5a5e`:

| Gate | Result |
|---|---|
| `pnpm -r test` | 798 passed — 413 engine · 72 db · 313 web |
| `pnpm -r typecheck` | clean, all three packages |
| `pnpm lint` | no warnings or errors |
| `node .claude/skills/design-review/audit.mjs` | clean |
| `NEXT_DIST_DIR=.next-verify pnpm build` | succeeded |

The production build was the one gate the previous handoff had never run. It
passes. **The code gate is done; what remains is review, data, and operations.**

Sizes are rough: **S** under an hour · **M** a session · **L** more than a
session. 🔒 marks something that is hard or impossible to undo.

---
# Review pass — the work queue

Twenty-one items from a walkthrough of the running site on 2026-11-08.
**Worked top to bottom.** Status is maintained here as each lands, so this
section alone answers "what is built and what is missing".

Three decisions were settled in the same pass: images go to **Vercel Blob**,
the editorial section becomes **`/blog`** (same word in both languages), and
the **wizard owns setup** while the tournament page shrinks to day-of tools.

| # | Item | Size | Status |
|---|---|---|---|
| RV-1 | "Todos contra todos" → "Round robin" | S | ✅ done |
| RV-2 | Remove the consolation explainer | S | ✅ done |
| RV-3 | Remove the draw blurb, entrant count, "partidos del cuadro principal" | S | ✅ done |
| RV-4 | Remove the **Recorrido** button and its `/path` route | S | ✅ done |
| RV-5 | Remove `/admin/categories` | S | ✅ done |
| RV-6 | `/t/:slug` goes straight to the draws | S | ✅ done |
| RV-7 | The balls belong to the header, on every page | S | ✅ done |
| RV-8 | One upcoming tournament, two card styles | S | ✅ done |
| RV-9 | Footer: icons, and a seam | S | ⬜ next |
| RV-10 | The print page cannot print | S | ⬜ |
| RV-12 | "First-round placement" does not explain itself | S | ⬜ |
| RV-19 | Create-tournament button placement | S | ⬜ |
| RV-4b | Match page player links → `/p/:playerId` | S | ⬜ |
| RV-14 | `/updates` becomes `/blog` | S | ⬜ |
| RV-11 | Order of play: by court or time, filtered by category | M | ⬜ |
| RV-13 | Transitions and motion | M | ⬜ |
| RV-17 | Tournament creation wizard, nav shrinks | L | ⬜ |
| RV-18 | Results entry on the draw itself | L | ⬜ |
| RV-15 | A real editor for the blog | L | ⬜ |
| RV-16 | Image uploads on Vercel Blob | L | ⬜ |

RV-15 and RV-16 are last on purpose: they are one piece of work, and RV-16 is
the half that has to exist first for RV-15 to be worth using.

---

## ✅ RV-1 … RV-5 — copy and deletions · S

| | |
|---|---|
| **RV-1** | `roundRobin` was "Todos contra todos" in the admin. Now "Round robin" in both dictionaries — the organizers use the English term. |
| **RV-2** | Removed the consolation explainer ("Un segundo cuadro para quienes perdieron su primer partido…"). |
| **RV-3** | Removed the draw blurb ("Cuadro al azar sin cabezas de serie, N inscritos…"), the standalone **Inscritos** count, and "partidos del cuadro principal". |
| **RV-4** | Removed the **Recorrido** button and the `/t/:slug/:category/:discipline/path` route behind it. |
| **RV-5** | Removed `/admin/categories`. The six-rung ladder is fixed and was never going to be edited from a screen. |

## ✅ RV-6 — `/t/:slug` goes straight to the draws · S

**Settles OT-17**, which the backlog had parked as "waiting on Luis". The hub
is a stop between wanting a draw and seeing one; the `DrawSwitcher` on the
draw page already moves between categories without a round trip.

Implemented as a redirect to the **first playable draw in ladder order** —
`/t/copa-otono-open-tennis-26` now 307s to `…/open/singles`.

The overview is kept as the **fallback**, not deleted, and that is the
difference from the original redirect this reverts to. When no category has a
generated draw there is nothing to redirect *to*, and the old version dropped
the visitor on a bracket that did not exist. Now they get dates, entry state,
and a status for every category including the ones they cannot click.
`/t/:slug` never 404s for a published tournament (PRD §4.4).

## ✅ RV-7 — The balls belong to the header · S

`<BallScene />` was passed as a prop from `app/page.tsx` alone, so it was a
property of one route rather than of the masthead. It now defaults on inside
`components/page-header.tsx` and every public page carries it.

**`variant="tool"` does not get it.** The admin masthead is dense and the
design system warns against decoration competing with data. Pass `scene`
explicitly to override in either direction, `null` to suppress. Say the word
if you want it on admin too — it is a one-line change.

## ✅ RV-8 — One upcoming tournament, two card styles · S

The feature card now means **"being played right now"**, and nothing else. It
used to fall back to the next tournament up, which is what put a big card and
a compact row under one **Próximos** heading. Those two tournaments are peers,
so giving one of them three times the space read as an inconsistency because
it was one. With nothing live, every upcoming tournament is a row.

---

## ⬜ RV-9 — Footer: icons, and a seam · S
Replace the text links with icons, and divide the footer into regions. One
hairline is not enough separation — everything currently blends.

## ⬜ RV-10 — The print page cannot print · S
`/admin/:slug/print` renders a sheet and offers no print or export control.
Add both. The print CSS already hides `body header`/`nav`/`footer`, so the
button has to be inside the printable component and hidden by that rule — and
it must be a `div`, never a `<header>` (see CLAUDE.md).

## ⬜ RV-12 — "First-round placement" does not explain itself · S
The slot-swap control reads as a puzzle: *"Choosing a different entrant swaps
the two."* Its actual job is one thing — separating two club-mates the random
draw paired in round one. Say that, or cut the section and leave redraw as the
escape hatch.

## ⬜ RV-19 — The create-tournament button exists · S
`app/admin/page.tsx` already links `/admin/new`. If it was not findable the
problem is placement on the admin home, not a missing feature. Look before
building.

## ⬜ RV-4b — Match page player links · S
Those links pointed at the deleted `/path` route and went with it. The better
destination is `/p/:playerId`, which already exists — but `DrawSide` carries
`entrantId`, not `playerId`, so it needs plumbing through `lib/queries.ts`
rather than a swapped href.

## ⬜ RV-14 — `/updates` becomes `/blog` · S
**Decided: "Blog" in both languages.** Route, nav label, dictionary keys, and
the user-facing strings. The `updates` table name can stay — renaming it buys
nothing and costs a migration.

## ⬜ RV-11 — Order of play needs axes and a filter · M
Today it is one list. It needs a view toggle — **by court** or **by time** —
and a category filter. The engine already assigns `courtIndex` and the
scheduler persists `courtId`, so the data is there; this is presentation.

## ⬜ RV-13 — Transitions and motion · M
No fluidity between pages. The design system names nine motions and they are
barely used. Route transitions plus component-level animation. Scope against
`docs/design-system.md` §7 so this does not become the thing that makes the
site look generated.

## ⬜ RV-17 — Tournament creation wizard · L
**Decided: the wizard owns setup; the tournament page shrinks to running the
event.** Step-by-step on create — dates and venue, the category × discipline
grid, per-cell format, scoring, courts, fees, entry settings. Afterwards the
tournament page carries only day-of tools (scores, order of play,
scorekeepers, QR, public link) plus one Settings screen for everything else.

This is what the nine buttons in the admin bar become, so RV-17 subsumes that
complaint rather than reorganising it twice. The CSV export moves to Settings
(see below).

## ⬜ RV-18 — Results entry on the draw itself · L
Today's scores screen is a list because an organizer works an order of play.
The ask is the other shape: the actual bracket with a result box in each
match. Both have a case — the bracket is better for a small draw and worse for
a long day across courts — so build it as a **view toggle on the existing
screen**, not a replacement.

## ⬜ RV-15 — A real editor for the blog · L
> *Markdown: ## Heading, \*\*bold\*\*, \*italic\*… HTML is escaped, not rendered.*

An organizer will not learn that. Wants a conventional toolbar: size, bold,
italic, alignment preserved.

**The constraint to design around:** the body is stored as Markdown precisely
because an HTML textarea on a public page is a stored-XSS hole, and
`lib/markdown.ts` emits a fixed element set. A WYSIWYG must therefore
serialise *back to Markdown*, not store HTML. Alignment has no Markdown
representation, so it needs an agreed extension or its own column.

## ⬜ RV-16 — Image uploads, on Vercel Blob · L
**Decided: Vercel Blob.** No upload pipeline exists today — `media_items.url`
and `updates.cover_url` are URLs on the assumption that "whatever uploads them
later only has to produce a URL". Build that: signed client upload from the
admin form, the returned URL into the existing columns, and `next.config.ts`
`remotePatterns` extended to the blob host **and nothing else** — the empty
array is the current SSRF guard and must not become a wildcard.

---

## Answered: what is the CSV export for?

Fair challenge. The honest case, having read it:

- **It is the only way data leaves the system.** Nothing is emailed, there is
  no public API, and an archived tournament is otherwise only readable inside
  the app. A club that cannot get its own results out is locked into software
  it does not control.
- **The import half is load-bearing.** `lib/csv.ts` also exports `parseCsv`,
  which is how an entrant list arrives from a spreadsheet. Removing the export
  would leave a one-directional module and a club that can type a list in but
  never get it back.
- **Someone thought about it.** The field guard prefixes `=`, `+`, `-`, `@` so
  a player called "-Álvarez" is not executed as a formula in Excel. That is a
  real security bug it is already closing.

Against: nobody has asked for it, and it is listed as untested in OT-38–OT-49.

**Recommendation — keep the route, drop it from the nav.** It costs nothing
where it is, and under RV-17 the tournament page should carry only day-of
tools. It belongs in Settings.

## Blocking the first real tournament

### PR-1 — Get batch 3 reviewed and merged · M
16 tickets, 10 commits, pushed (`origin/batch3-organizer-truthfulness` matches
local). No PR open as far as can be told from this machine — `gh` is not
installed here, so check GitHub directly.

1. Open a PR against `main` (`737a10a`). Link
   `docs/specs/opentennis-qa-backlog.md` in the body.
2. Record all five gate commands above in the body, at this SHA.
3. Confirm the preview for that exact SHA is Ready before anyone reviews.
4. QA grades the 16 batch-3 tickets plus a regression of batches 1 and 2.
   The six items needing a human eye are listed in
   `docs/archive/grok/HANDOFF.md` → "Batch 3 — what QA should press on".
   That file is **local only** — `.gitignore` ignores `grok/` at any depth, so
   a fresh clone will not have it. Paste the list into the PR body.

**Two product decisions are waiting on Luis and should be settled before
merge, not after:**

- **OT-17 reverses an earlier call.** `/t/:slug` was a category grid; it was
  removed as a pointless stop between wanting a draw and seeing one, and
  became a redirect to the first draw. It is a hub again — dates, venue,
  entry state, and a status for every category including the unclickable
  ones, which the redirect hid. Keep it or revert it.
- **OT-9 was not built as specified.** The ticket asked for a confirmation
  before bulk generation replaces results. `generateDraws` cannot replace
  anything — it skips any event that already has matches — so there was no
  destructive path to gate, and a warning for one would teach organizers to
  click through warnings that do not mean what they say. The button now
  states what it will actually do. Accept or reopen.

### PROD-1 — Create the real tournament in production · M 🔒
The `production` Neon branch carries the organization, the admin user, and the
six-category ladder. **Nothing else.** Copa Otoño, Invierno and every seeded
entrant live on `development`.

Going live is therefore data entry against production: the tournament, its
category × discipline grid, courts and schedule windows, and the entrant list.
Needs the club's real categories and real entrants. Nothing in the app blocks
it; nobody has done it.

Do PROD-1 before QR-1. Generating a draw is a one-way door
(`generateDraws` refuses while `entriesOpen` and skips events that already have
matches; replacing is `redrawEvent`, which refuses once any match has a winner).

### ADM-8 — Doubles pairing UI and unpaired tray · L
The last open item from the feature backlog, **waiting on the club to say what
the flow should be.**

A tournament is categories × singles *and doubles*, so unless the first real
event is singles-only this is a functional gap, not polish — an organizer
hits it mid-setup with no way through. Get the flow decided; it is the item
most likely to stop the tournament.

### QR-1 — Generate and print QR codes from www.opentennis.mx · S 🔒
`/admin/:slug/qr` builds absolute URLs from the request headers, so a sheet
printed from localhost points at localhost forever. Nothing is ever emailed —
QR codes and social links *are* the distribution channel, which makes this
infrastructure rather than a convenience.

Irreversible once printed on a poster. Generate on www, after PROD-1.

Changing the canonical host later does not break printed codes: the apex 308s
to www, and `/t/:slug` must keep resolving forever (PRD §4.4).

### OPS-1 — Snapshot discipline for tournament day · S — **procedure written, two actions left**
Scores are entered courtside on phones during a live event. That is when a
mistake is most expensive and least recoverable.

**The recovery window is six hours and a tournament day is longer.** Verified
on the project today: `history_retention_seconds` is `21600`. A result
destroyed in the morning and noticed that evening cannot be restored. The
`production` branch is also unprotected (`protected: false`), so nothing stops
a delete.

The app guards the obvious paths well — `redrawEvent` refuses once a match has
a winner, clearing a result is refused when a later match is already decided,
empty-draw delete asks for the draw name, and a non-owner admin has no delete
control. None of that helps against a bad bulk action or a wrong-branch write.

The procedure is now in `CLAUDE.md` → "Recovering data": take a copy-on-write
snapshot branch before entries close and every couple of hours during the
event, since a branch outlives the 6-hour window and costs almost nothing.
Recovery is a copy-forward, never a branch promotion — swapping branches
mid-event would discard every score entered since the snapshot.

Two things still to do, neither of them code:

1. Turn on branch protection for `production`.
2. Check whether the plan can raise retention past six hours. If it can, do
   it — the snapshot discipline is a workaround for a 6-hour window, not a
   replacement for a real one.

Related, already known and not fixable in time: `updated_at` is a creation
time on every table (`timestamps()` has `defaultNow()` and no `$onUpdate`, and
there is no trigger). Reconstructing "what changed when" for a disputed result
has to come from `score_events`, which gets exactly one row per scoring path
including `clearResult`.

---

## Before posters go up

### SEC-1 — Gate `/style-guide` in production · S — **done, this pass**
OT-29. The component gallery was reachable at
`https://www.opentennis.mx/style-guide`. It reads the live category ladder and
renders sample tournament cells, so a visitor who guessed the URL saw a
fake tournament presented as real.

Now 404s when `VERCEL_ENV === 'production'` and stays available locally and on
preview, where it is actually used.

### DATA-1 — Confirm no test fixtures are visible on production · S
Batch 4 says OT-26/27/28 are development-only. Verify rather than assume,
because these are the things a visitor scanning a poster would see first:

- the "Consolación 27901" test tournament, featured as live (*En curso*)
- test-style public names — `Uno1`, `Turnstile`, numeric ids
- published story and gallery fixtures, including an escaped XSS string and
  mismatched captions

Hiding a tournament removes it from the homepage and 404s the direct URL, so
the fix is cheap if any of it *is* on production. Do not delete Copa Otoño or
Invierno or their real entrants.

### ROLE-1 — Create the day's accounts at the right role · S
Role enforcement shipped and works: `packages/db/src/roles.ts` defines
`owner` / `admin` / `scorekeeper` / `viewer` against nine capabilities, and
`requireCapability` / `guardCapability` are wired into 11 admin action and page
files. (The archived backlog claims this is unenforced. It is wrong; that line
sent at least one reader chasing a blocker that did not exist.)

What is left is operational: when accounts are made for tournament day, give
scorekeepers `scorekeeper`, not `admin`. The capability that matters is
`destructive` — deleting a tournament and every result under it — and it
belongs to `owner` alone.

Scorekeepers who only need to enter scores should get revocable link tokens
rather than accounts at all. Revoke invalidates immediately.

---

## Decisions, not work

### DEC-1 — Decide whether Stripe is on for this tournament · S
Payments are **fully built**, which contradicts both the README (now fixed)
and `docs/archive/entry-fees-deferred.md` (now archived): `lib/stripe.ts`,
the admin fee panel, `enter/pay-actions.ts`, and a signature-verified webhook
with replay protection at `/api/webhooks/stripe`. Card, OXXO and SPEI, MXN
only for the cash rails. Checkout is Stripe-hosted, so no card number reaches
this server (PCI SAQ-A).

It degrades cleanly: with no `STRIPE_SECRET_KEY` the pay buttons disappear and
the manual tick still works. **So this blocks nothing** — but decide
deliberately rather than by omission:

- **Off** — leave the key unset. Entry stays zero-fee with pay-at-reception.
  Consider whether a live webhook route you do not intend to use should be
  reachable at all.
- **On** — set `STRIPE_SECRET_KEY` and the webhook signing secret in Vercel
  production, and test one real checkout per rail before entries open. OXXO
  vouchers take hours to clear; do not discover that on tournament day.

### DEC-2 — Turnstile · S
Optional and `lib/turnstile.ts` fails open on purpose, including when
Cloudflare is unreachable, because a spam gate that takes the entry form down
with it is worse than the spam. With neither key set, no challenge is shown
and the form works exactly as before. Set **both** keys or neither; one alone
is treated as unset. Fine to launch without.

---

## Housekeeping — done this pass

- **DOC-1** — `README.md` rewritten. It said *"Specification phase. No code
  yet"* for a product that is live with 798 tests, and *"No payments, ever…
  entirely out of PCI scope"* for a product with a Stripe dependency and a
  live webhook. Both were actively misleading.
- **DOC-2** — superseded docs moved to `docs/archive/` with a README saying
  why each one is there. See that file for what was deliberately *not*
  archived.
- **DOC-3** — `CLAUDE.md`: recorded that `NEXT_DIST_DIR=.next-verify pnpm
  build` rewrites `apps/web/next-env.d.ts` to point at `.next-verify`.
  Committing that breaks typecheck for everyone once the directory is gone.
  Added `.next-verify/` to `.gitignore` — `.next/` does not match it.

---

## Out of scope

OT-38–OT-49 are remaining QA coverage, not a build list. Do not implement
speculative features for them.

Batch 4 (OT-26–OT-37) is content and polish beyond DATA-1 — pluralization,
locale refresh, logo paint, nav contrast. Nothing there stops a tournament.
OT-31 is already decided: "Cancha" stays in both languages.
