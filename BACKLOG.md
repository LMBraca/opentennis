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
| RV-20 | Remove "Actualización automática", the bracket minimap, restyle "Todo el blog" | S | ✅ done |
| RV-15 | A real editor for the blog | L | ⬜ |
| RV-16 | Image uploads on Vercel Blob | L | ✅ built, unverified — needs the store |

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

## ✅ RV-16 — Image uploads, on Vercel Blob · L — **built, not yet verified**
`@vercel/blob` client upload. The browser uploads straight to the store;
`/api/blob/upload` only issues the short-lived token, so a 4MB photo never
touches the serverless function's request body limit.

**The security is entirely in `onBeforeGenerateToken`** — that callback is
the only gate between the public internet and the club's store. The rule
lives in `lib/upload-policy.ts` with its own tests, and that separation is
load-bearing rather than tidiness: `handleUpload` resolves the store token
*before* it calls the gate, so against an unconfigured store the route fails
on the missing token and the gate never runs. An end-to-end "can a stranger
upload?" test passes for entirely the wrong reason. Confirmed by reading the
library source.

`onUploadCompleted` is deliberately empty. Vercel calls it from its own
infrastructure so it cannot see our session, and it never fires on
localhost. The URL returns to the browser and is submitted with the form
like any other field.

`remotePatterns` was an empty array on purpose — no remote pattern, no SSRF
surface on the image optimiser. It now carries one entry: `BLOB_HOSTNAME`
when set, otherwise a subdomain wildcard on Vercel's blob domain. That is a
wildcard on one vendor's hostname, not the `**` that would open the
optimiser to anything.

**What is unverified:** every path that needs a real token. No upload has
ever succeeded, because there is no store. When `BLOB_READ_WRITE_TOKEN`
exists: upload a photo, confirm it renders through `next/image` on the
public post, then set `BLOB_HOSTNAME` to the exact host to narrow the
pattern.

## ✅ RV-20 — three things from the walkthrough · S
- **"Actualización automática" is gone from view.** A working thing
  announcing that it works, on every draw page. The dot already says live.
  `reconnecting` and `stopped` keep their text — those mean the scores on
  screen may be stale, which is the one thing worth interrupting for. The
  live label survives visually-hidden: a `role="status"` region containing
  only an `aria-hidden` dot announces nothing, and "is this still updating"
  is a question a non-sighted reader has too.
- **The bracket minimap is gone.** It had a click handler, but it was a
  `div` rather than a button and `aria-hidden`, so no keyboard or
  screen-reader user could reach it at all — and visually it did not read as
  a control. A control nobody can tell is a control is decoration with an
  onClick. Its `nodes` prop, viewport tracking and scroll listener went with
  it.
- **"Todo el blog" moved into the section heading.** Floating under the
  cards it was the only bare coloured line of text on the page and read as
  an orphan; paired with the heading it is an ordinary section-header
  affordance.
