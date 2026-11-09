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
| RV-9 | Footer: icons, and a seam | S | ✅ done |
| RV-10 | The print page cannot print | S | ✅ done |
| RV-12 | "First-round placement" does not explain itself | S | ✅ done |
| RV-19 | Create-tournament button placement | S | ✅ investigated — folded into RV-17 |
| RV-4b | Match page player links → `/p/:playerId` | S | ✅ done |
| RV-14 | `/updates` becomes `/blog` | S | ✅ done |
| RV-11 | Order of play: by court or time, filtered by category | M | ✅ done |
| RV-13 | Transitions and motion | M | ✅ done |
| RV-17 | Tournament creation wizard, nav shrinks | L | ✅ done |
| RV-18 | Results entry on the draw itself | L | ⬜ next |
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

## ✅ RV-9 — Footer: icons, and a seam · S
Instagram and Facebook are inline SVG marks now, hand-drawn rather than a
second icon package for two links — `lucide-react` is already a dependency
but dropped brand icons, and the design system bans emoji as icons. The glyph
is 20px inside a 44px box, so the coarse-pointer hack that used to expand an
18px text target is gone.

The seam: the footer sits on a `--clay-100` surface with its own radius, and
the club and sponsor are stacked in two regions divided by their own rule
rather than sitting side by side. Line weight and surface tint are the only
depth this design system allows, and one hairline was not enough. A side
effect worth having — a paid credit no longer reads as one of the club's own
links.

## ✅ RV-10 — The print page cannot print · S
**Reverses an explicit earlier decision**, recorded in that file: no button
and no client JS, because the browser's print command exists everywhere and
this would be the only admin page shipping JS for it. That was right about
cost and wrong about discoverability — a page titled "Hojas de cuadro" that
renders a sheet and offers no control reads as unfinished, and it was
reported as broken, which settles it.

`components/print-button.tsx`, matching `.newButton` rather than inventing a
fourth button shape. It carries its own `@media print { display: none }`: the
sheet's print rules drop `body header`/`nav`/`footer` and the button is none
of those, so without that rule it would print on the paper. No export button
— a bracket as CSV is meaningless, and the results export belongs in Settings
under RV-17.

## ✅ RV-12 — "First-round placement" does not explain itself · S
Kept the control, rewrote the framing. "First-round placement" and "choosing
a different entrant swaps the two" both describe what the control does to the
data and never say what it is *for*. Now **"Separate two players"**, and the
hint leads with the situation — the draw is random and sometimes pairs two
club-mates — before the mechanic, with the swap explained rather than stated
so nobody wonders why their other player moved.

## ✅ RV-19 — The create-tournament button exists · S — *investigated, no change*
It is there: `app/admin/page.tsx`, a filled clay primary button reading **New
tournament**, gated on `tournaments:manage` which the owner has. Admin
sub-pages carry a back link to `/admin`, so it is never more than one click
away.

Two things make it easy to miss, and both are RV-17's to fix rather than
worth changing twice: it sits in a row with two *navigation* buttons (Blog &
media, Players), so a create action is mixed in with places to go; and it is
only on the admin home, not in the masthead that every admin page shares. No
change made — RV-17 restructures this nav wholesale.

## ✅ RV-4b — Match page player links · S
`MatchSideView` carries `players: {id, lastName}[]` now, and the match page
links each person to `/p/:playerId`.

One link per **person**, not per side, so a doubles match offers both halves
of each pair instead of one link labelled with two surnames. The joined
"Alvarez / Chen" display string is derived from the same rows rather than
being the only thing fetched — splitting it back apart to recover ids breaks
on any surname containing a space.

Dropped `entrantName()` on the way past: its only caller was the path page
deleted in RV-4.

## ✅ RV-14 — `/updates` becomes `/blog` · S
Route moved to `/blog`, labels say **Blog** in both locales, and the admin
section is **Blog & media** / **Blog y galería**.

`/updates` and `/updates/:slug` **308 permanently** to the new paths. These
URLs have been shared — a post linked into a WhatsApp group months ago should
not 404 because a nav label changed.

The `updates` table keeps its name. Renaming it buys nothing and costs a
migration.

## ✅ RV-11 — Order of play needs axes and a filter · M
`?view=time|court` and `?draw=<category>-<discipline>`, rendered as chips
above the sheet.

**State lives in the URL, not in a component.** Three reasons, all specific
to this page: it stays a server component, so the sheet renders with no
client JavaScript — the same call the draw sheet makes, and this page gets
printed off the wall every morning; a filtered view can be bookmarked or
sent to someone; and printing captures what is on screen, so the organizer
prints the view they chose. Links rather than a `<select>` for the same
reason — a select needs JS to navigate on change.

Two details worth keeping:

- **Filter options are collected before the filter is applied.** Building
  them from the filtered set collapses the row to the one draw you picked,
  with no way back to the others.
- **The scheduled count follows the filter.** "34 programados" above six
  rows of C+ is the kind of number that makes an organizer distrust the
  page.

Court sort is `localeCompare(…, { numeric: true })`, so Cancha 2 comes
before Cancha 10. The controls carry `@media print { display: none }` — the
sheet on the wall should not show the controls used to produce it.

## ✅ RV-13 — Transitions and motion · M
**Route transitions, via the View Transitions API.** `experimental.viewTransition`
in `next.config.ts` plus `::view-transition-*` rules in `globals.css`.

The diagnosis was that **none of the nine motions covers navigation** — every
one of them describes what happens *within* a page, which is exactly why
moving between pages was the only thing that felt abrupt. Nothing was broken;
there was simply no motion specified for the case.

The browser composites both snapshots, so this costs no JavaScript and no
layout work. Opacity and a 4px rise, nothing larger: the spec permits only
`transform` / `opacity` / `clip-path` / `stroke-dashoffset` / `filter`, and a
page-sized slide is the kind of motion that reads as a template.

**The masthead is opted out** (`view-transition-name: masthead`, animation
none). It is the same band on every page, so cross-fading it against itself
is a flicker on something that did not change — pinning it is what makes a
navigation read as one site rather than two screenshots.

Reduced motion is a hard gate per §5: the transition becomes an instant state
change, not a faster one.

The other eight motions were already built against the tokens in
`app/tokens.css`, with a three-tier system in `lib/motion/tier.ts` that does
not even download the animation code at the `off` tier.

## ✅ Terminology sweep — found four things the rename missed
Prompted by "Todas las novedades" still reading novedades. A full pass over
every term changed in this review found:

| | |
|---|---|
| **Functional bug** | `update-actions.ts` still called `revalidatePath('/updates/:slug')`. The public route is `/blog/:slug`, so **publishing or editing a post never revalidated its own page** — the edit would simply not appear. |
| **Live 404** | `/p/:playerId` still linked each entry to the `/path` route deleted in RV-4. Now points at the draw, which is the useful destination anyway. |
| Stale labels | `allUpdates`, `newUpdateTitle`, `editUpdateTitle` — none contain "updates" in a way the first grep caught. Now *Todo el blog*, *Nueva publicación*, *Editar publicación*. |
| Dead code | `pathTitle`, `viewPath`, `consolationLead` keys in both locales, and the orphaned `.consolationLead` CSS rule. |

The lesson for the remaining renames: grep the **values**, not the key names.
`allUpdates: 'Todas las novedades'` is invisible to a search for either
"updates" or "novedades" if you only look at one side of the colon.

## ✅ RV-17 — Tournament creation wizard · L

**The wizard is a guided walk over a draft, not a parallel flow.**
`createTournament` already produced a draft that nothing public could see,
so each step is an ordinary edit of a real row. Three things fall out of
that: a half-finished setup survives a closed laptop, every step stays
reachable afterwards for an edit, and there is no wizard state to lose.

Creating a tournament now lands on `/admin/:slug/setup/draws` rather than an
empty tournament page that could only say "no draws, no courts, no entries"
three times over.

**Two of the three steps are the existing screens**, reached with `?setup=1`
so they render the path. Only the draws step needed a page of its own, and
it renders the tournament page's own `AdminGrid`. Three purpose-built wizard
screens would mean a second copy of the court form and a second copy of the
entry controls, and this repo has paid for that mistake twice — twelve
mastheads, then the footer.

Steps are ordered by dependency, not preference: draws need categories
chosen, the scheduler needs courts, entries should not open before there is
something to enter. Nothing is mandatory, so "done" in the stepper means
"behind you" rather than "valid" — a tick claiming completeness would lie
about steps the organizer skipped on purpose. **Skip for now** is on every
step.

**The nav shrank from eight to six** plus one Configuración entry. What
stays is what gets touched with a tournament in progress: entries, scores,
order of play, scorekeepers, QR codes, draw sheets. `schedule` left because
courts and windows are decided up front; `export` left because it is
occasional rather than day-of — which also settles the CSV question from
this review, since it now lives in Settings exactly as recommended.
Configuración sits behind a rule at the end of the row rather than as a
seventh equal button, because it is a different kind of thing.

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
serialise *back to Markdown*, not store HTML.

**Decided (mine, 2026-11-08):**

1. **TipTap/ProseMirror, not a hand-rolled editor and not a Markdown
   toolbar.** This repo hand-rolls CSV and Markdown on the grounds that each
   is "one escaping rule and one parsing rule" — true for both, and false for
   a rich-text editor. Selection, input rules, undo across composed input and
   mobile IME are not a weekend. A toolbar that inserts `**` around a
   selection is also rejected: it still shows the author asterisks, which is
   the exact complaint.
2. **Markdown stays the stored format and `lib/markdown.ts` stays the
   security boundary.** The editor serialises down to it on save; the public
   page renders through the same fixed element set it does today. Nothing
   about the XSS posture changes, and a post written before the editor
   existed still opens in it.
3. **The schema is constrained to what the renderer supports** — headings,
   bold, italic, lists, links, paragraphs. A toolbar button that produces
   Markdown the renderer drops is worse than no button, so the editor's
   allowed nodes are derived from the renderer rather than from TipTap's
   defaults.
4. **Alignment: `:::center` / `:::right` fenced blocks**, taught to
   `lib/markdown.ts` as a block directive. Not a column — alignment is
   per-paragraph, and a document-level column cannot express "this one pull
   quote is centred". Default (left) writes no marker at all, so existing
   posts are untouched and the common case stays clean Markdown.
5. **Built after RV-16.** A rich editor whose only way to add a picture is to
   paste a URL is not the thing that was asked for.

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
