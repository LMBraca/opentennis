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
| RV-13 | Route transitions | M | ✅ done |
| RV-21 | Component motion — Draw Reveal, Court Loader | M | ✅ done |
| RV-17 | Tournament creation wizard, nav shrinks | L | ✅ done |
| RV-18 | Results entry on the draw itself | L | ✅ done |
| RV-20 | Remove "Actualización automática", the bracket minimap, and "Todo el blog" | S | ✅ done |
| RV-15 | A real editor for the blog | L | ✅ done |
| RV-16 | Image uploads on Vercel Blob | L | ✅ store live, round-trip verified |

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

**This covered page transitions only.** The "more effects on the components"
half of the same request is RV-21 below — I reported RV-13 as done when it
had addressed half the ask.

## ✅ RV-21 — component motion · M

An audit of the nine motions in `docs/design-system.md` §5 against what was
actually built:

| Motion | Before | Now |
|---|---|---|
| 1 Draw Reveal | keyframe `ot-rise-in` defined, **used nowhere** | built |
| 4 Live Pulse | built | — |
| 5 Pan & Zoom | zoom only | zoom only |
| 9 Court Loader | keyframe `ot-ball-arc` defined, **used nowhere** | built |
| 2, 3, 6, 7, 8 | unbuilt | unbuilt |

Two keyframes had been written and wired to nothing. Finishing those was
the highest value per line in the file.

**Draw Reveal** — nodes arrive round by round, left to right, at the spec's
28ms within a round and 90ms between them. The offset is a
`--reveal-delay` custom property computed from the node's own round and
slot, so the timing stays in CSS where the reduced-motion gate can switch
it off wholesale. Index-based rather than observer-based: a bracket paints
once, and 64 IntersectionObservers to animate something already on screen
is not a trade worth making.

**Court Loader** — the product had no loading state at all, so a slow
connection got a blank screen with no sign the tap had registered. Now a
root `app/loading.tsx` renders the ball traversing its arc. This is the one
place optic yellow appears without meaning "live right now", and it is a
deliberate exception: the ball is the brand's object and a loader is not a
match.

Both are hard-gated under `prefers-reduced-motion` — stopped, not
shortened. A 64-draw staggers over about a second, and a second of movement
is exactly what someone who asked for less motion is asking not to get.

Still unbuilt, in rough value order: **Advance Line** (3) is the one the
spec calls "the single most satisfying moment in the product" — the
connector drawing when a match completes; the geometry is already exported
as `data-length` on every connector path, waiting for it. Then **Score
Tick** (2) and **Standings Reorder** (7). **Champion Reveal** (8) is a
900ms set piece worth doing once a real final has been played on it.

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

## ✅ RV-18 — Results entry on the draw itself · L
`?view=list` (default) or `?view=draw` on the scores screen. A **toggle,
not a replacement**: the list groups by what you can do next and is the
right shape for working an order of play across courts; the draw answers
"where is this match, and who does the winner meet". Both are wanted.

**It reuses `Row`.** The score editor, Clear, Undo, the refusal states and
every rule in `lib/match-result.ts` are literally the same component in
both views. A second entry form rendered in a bracket shape is how two ways
to record a result start disagreeing about what a valid one is.

**Not the public `Bracket`.** That renders connectors from engine geometry
and takes `DrawRound` data this page does not load; pulling it in would
mean the admin loading a second shape of the same matches. Rounds as
columns in bracket order carry the structure, which is what the question
needs — the connector lines are the part that would have cost a rewrite.

The draw view shows **every** match including the unplayable ones, because
a bracket without its empty slots is not the shape an organizer is looking
at.

Columns are a fixed 19rem and scroll inside their own box. Fluid columns
would resize as matches opened and closed, making the whole draw jump under
the cursor; and the body must never scroll sideways.

**Grouping lives in `lib/draw-grouping.ts` with five tests.** The admin
screens are behind a session, so I could not render this from a test runner
or a curl — the route returns the login page at 200. Logic I cannot reach
through the UI gets asserted directly or it ships unverified, which is the
same lesson the upload gate taught. One of those tests exists because
sorting draws alphabetically would put C+ above Open.

**Unverified:** the rendered layout. Everything compiles, typechecks and the
grouping is tested, but nobody has looked at the columns in a browser.

## ✅ RV-15 — A real editor for the blog · L
TipTap, with a toolbar: headings, bold, italic, both list kinds, quote,
and left/centre/right.

**What is stored did not change.** The body is still Markdown and
`lib/markdown.ts` is still the only thing that turns it into HTML, so the
security posture is identical — storing the editor's HTML instead would be
the same stored-XSS hole with a nicer toolbar on top. The editor is a view
over the same field:

- **open** — `renderMarkdown(body)` on the server → HTML → TipTap
- **save** — TipTap → `htmlToMarkdown()` → the same hidden input as before

Both directions are anchored on the renderer, so the toolbar **cannot
produce something the public page will not show**. That is the failure this
design exists to prevent: a button that appears to work and silently does
nothing once you hit save. The extension set is derived from the renderer's
subset for the same reason — `codeBlock`, `code`, `horizontalRule` and
`strike` are switched off because they would serialise to nothing.

**Alignment is `:::center` / `:::right`**, taught to `lib/markdown.ts` as a
block directive. Left writes no marker, so every post written before this
is untouched. The editor writes it as a `md-align-*` class rather than
TipTap's `style="text-align"`, because that is exactly what the renderer
emits and it makes the round trip the identity function instead of two
spellings of one idea.

`lib/html-to-markdown.ts` has **11 tests**, two of which round-trip through
`renderMarkdown` itself. One exists because the renderer shifts author
headings down a level (h1 is the page title), so coming back has to shift
up by the same one — without it every save would demote every heading.
Another asserts that an unknown tag is flattened to its text, which is the
whole point: no HTML survives to the store.

Six more tests cover the directive in `markdown.test.ts`, including that an
unknown alignment is ignored rather than emitted as a class.

**Unverified:** typing in it. The editor compiles, the production build
passes with it, and both serialisation directions are tested — but the
admin is behind a session and nobody has yet clicked Bold.

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

**Store is live** (2026-11-09): `opentennis-media`, `store_U1XjHWlW7XmQE8WY`,
region iad1. `BLOB_READ_WRITE_TOKEN` is injected into all three
environments; `BLOB_HOSTNAME` is pinned to
`u1xjhwlw7xmqe8wy.public.blob.vercel-storage.com` in production, preview
and `.env.local`, so the image optimiser now allows exactly one host
rather than the subdomain wildcard.

**Verified:** a real write → public read (200, bytes matched) → delete,
straight through the SDK against the live store. `/api/blob/upload` reports
`configured: true`.

**Still unverified:** the browser path — picking a file in the editor and
watching the URL land in the form. That needs a signed-in session, so it is
one for you rather than for me. If it fails, the error now names which of
the three problems it is rather than saying "Failed to retrieve the client
token".

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
- **"Todo el blog" is gone.** It was tried under the cards, then beside the
  heading, and looked wrong both times — which was the symptom, not the
  problem. **Blog is already in the masthead nav on every page**, so this
  was a second route to a destination one click away. Two paths to the same
  place is what made it impossible to style into looking deliberate; no
  amount of restyling fixes a link that should not exist. Its CSS and the
  now-dead `allUpdates` key went with it.
