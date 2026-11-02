# OpenTennis — Product Requirements Document

**Status:** Draft v0.1
**Last updated:** 2026-11-01
**Companion specs:** [`docs/tournament-formats.md`](docs/tournament-formats.md) · [`docs/design-system.md`](docs/design-system.md)

---

## 1. Summary

OpenTennis is a web application for running tennis tournaments. It has two faces:

- **Admin panel** — the organizer's workspace. Create a tournament, define events, enter players, seed and generate draws, assign courts, enter scores, publish results.
- **Public site** — the shareable face. A live bracket or standings table anyone can open on a phone at courtside without logging in.

The product bet is that the category's existing tools are functional but visually dated, and that a tournament bracket is an inherently beautiful object that nobody has rendered well on a phone. The design bar is a first-class requirement, not polish deferred to the end — see §8 and the design system spec.

### How a tournament is organized

A tournament is a **grid of skill categories × disciplines**. Each cell of that grid is a draw with its own format.

| | Singles | Doubles |
|---|---|---|
| **Open** | Round robin | Round robin |
| **A** | Round robin | Round robin |
| **B** | Round robin | Round robin |
| **C+** | Single elimination | Single elimination |
| **C** | Single elimination | Single elimination |
| **D** | Single elimination | Single elimination |

Those format assignments are **defaults, not rules.** The admin chooses which cells run and what format each one uses when creating the tournament. The pattern above reflects the usual reality — the stronger categories draw few enough entrants that a round robin gives everyone several matches, while the lower categories fill up and need a bracket — but any cell can be either format.

### Supported formats (v1)

- **Single elimination** — with byes, optional third-place playoff
- **Round robin** — single or double, with a visible tiebreaker cascade
- **Hybrid** — round robin groups feeding a single-elimination playoff

Singles/doubles is a property of the *entrant* (one player vs. a two-player team), not a separate format. The draw engine operates on opaque entrants and never needs to know how many humans are inside one. The same is true of category: it determines *which* draw an entrant is in, never how that draw behaves.

### The product has no concept of player skill

**OpenTennis does not know how good anyone is, and does not try to find out.** There are no ratings, no NTRP/UTR fields, no computed strength. Players self-select the category they want to enter, and the admin accepts or moves them. Three consequences run through the whole spec:

1. **Seeding is manual or absent.** There is no rating to sort by. An admin either drags entrants into a seed order from their own knowledge of the field, or runs an unseeded random draw. Unseeded is a legitimate default, not a degraded mode.
2. **There is no eligibility validation.** Nothing blocks or warns about which category someone enters. For doubles, a team enters one category and both partners are understood to be in it; there is no partner-rating rule to enforce because there are no ratings.
3. **Under-filled categories are a communication problem, not a software one.** See §5.3.

---

## 2. Goals & non-goals

### Goals

1. An organizer with no software background can take a tournament from zero to a published draw in under 10 minutes.
2. Scores can be entered one-handed, outdoors, on a phone, by someone standing next to a court.
3. A spectator can open a link and understand the state of the tournament in under 5 seconds.
4. The bracket is legible and navigable on a 390px-wide screen for draws up to 64 entrants.
5. The product looks like it was designed by someone with a point of view.

### Non-goals (v1)

- **Payment processing of any kind.** No card data touches this system, ever — which keeps it entirely outside PCI DSS scope. Entry-fee *tracking* is also out of v1; the design for it is parked in [`docs/entry-fees-deferred.md`](docs/entry-fees-deferred.md), ready to lift when wanted.
- **Player accounts.** Only admins authenticate. Entrants are records, not users — see §4.1.
- **Any notion of player skill** — no ratings, no NTRP/UTR import, no computed strength, no ELO. Players self-select their category. This is a product decision, not a scoping shortcut.
- **Outbound email and notifications of any kind.** OpenTennis never sends a message — no confirmations, no reminders, no announcements. Email is collected only as the identity key (§4.1) and so an organizer can reach people from their own inbox. Avoiding a send pipeline also avoids deliverability, bounces, unsubscribe compliance, and sender reputation. Distribution happens via **QR codes and social links** instead (§4.4).
- **Special handling for minors.** Junior entrants are stored and displayed identically to adults. No age field, no junior flag.
- **Offline support.** The venue has reliable signal. No service-worker caching, no local write queue, no sync indicator. A dropped request surfaces an honest error and a retry button.
- **Consolation draws and mixed doubles** — both deliberately deferred, see §12.
- League or season management across multiple tournaments
- Video streaming or ball tracking
- Umpire hardware / chair-unit integration
- Native mobile apps (the web app must be good enough that this isn't missed)

### Explicitly deferred but architected for

- Multi-tenant SaaS (orgs exist in the schema from day one)
- Public self-registration with waitlists
- Consolation and compass draws
- Double elimination

---

## 3. Personas

**Dana — club tournament director.** Runs 6–8 events a year at a 10-court club. Currently uses a whiteboard and a spreadsheet. Technically capable but impatient. Needs: fast draw generation, printable draw sheets, the ability to fix a mistake without starting over.

**Marco — courtside scorekeeper.** A volunteer or a parent. On his phone, in the sun, on club wifi that drops. Needs: enormous tap targets, no typing, works when the connection blips, impossible to submit a score for the wrong match.

**Priya — competitor.** Wants to know when and where she plays next, and who she'd face in the next round. Opens the link 20 times a day. Needs: "my next match" above everything else, and a path view of her route to the final.

**Sam — spectator/parent.** Following one player remotely. Needs: live scores, a clear bracket, something worth sharing to a group chat.

---

## 4. Domain model

The core hierarchy is the thing to get right, because it's what lets one tournament run a round robin for Open Singles and a 32-draw bracket for C Doubles at the same time.

```
Organization
├── Category[]              ordered ladder: Open, A, B, C+, C, D  (org-level, editable)
└── Tournament              (e.g. "Riverside Autumn Open 2026")
    └── Event               = Category × Discipline  ← format lives here
        │                     (e.g. "C+ Doubles")
        └── Stage           (e.g. "Group Stage", "Main Draw")
            ├── Group       (round robin pools only)
            └── Round
                └── Match
                    ├── MatchSide (×2) → Entrant
                    └── Set (×1..5)
```

**`Event` is the join of a category and a discipline.** It is not a free-text label. This is what makes the tournament-creation grid possible, lets the public site offer a category switcher, and guarantees every draw is addressable as "C+ Doubles" rather than whatever an organizer typed.

The category ladder lives at the **organization** level, not the tournament level. `Open, A, B, C+, C, D` ships as the default preset, and an org can rename tiers, add them, or reorder them once — then every tournament they run selects from that ladder. A per-tournament ladder would mean "B" meant something different in March than in September, which breaks any future cross-tournament history.

### Entities

| Entity | Key fields | Notes |
|---|---|---|
| `Organization` | name, slug, branding | Tenant boundary. Owns users and tournaments. |
| `Category` | orgId, code (`Open`,`A`,`B`,`C+`,`C`,`D`), label, rank, isActive | Ordered skill ladder, org-level. `rank` drives display order everywhere. A code is never reused for a different tier. |
| `Tournament` | name, slug, venue, startDate, endDate, status, visibility | Container. Holds courts and a shared player pool. |
| `Event` | tournamentId, **categoryId**, discipline (`singles`\|`doubles`), format, scoringFormat, status, minEntrants | The join of category × discipline — the unit a draw belongs to. Unique on (tournament, category, discipline). |
| `Player` | firstName, lastName, **email**, phone, clubAffiliation | Scoped to the organization, reusable across tournaments. **`email` is the identity key** — unique per org for form registrations, nullable and non-unique for admin-created records (§4.1). **No rating field** — see §1. |
| `Entrant` | eventId, seed, status (`pending`\|`active`\|`withdrawn`\|`noShow`), players[] | **The draw's atomic unit.** 1 player for singles, 2 for doubles. `seed` is admin-assigned or null — never computed. `pending` entrants are invisible to the public site. |
| `EntrySubmission` | tournamentId, rawPayload, submittedAt, ip, status (`pending`\|`accepted`\|`rejected`), reviewedBy, matchedPlayerId? | One public form submission, kept verbatim even after acceptance. The audit trail for "who said they wanted to play C+" when a dispute arises. |
| `Stage` | eventId, type (`roundRobin`\|`singleElimination`), order, config | Enables hybrid formats as an ordered list of stages. |
| `Group` | stageId, name, entrants[] | Round robin pools. |
| `Round` | stageId, index, name, groupId? | "Round of 16", "Quarterfinal", "RR Round 3". |
| `Match` | roundId, slotIndex, courtId, scheduledAt, status, winnerSideId, outcome | `outcome` ∈ `completed`\|`walkover`\|`retirement`\|`default`\|`unfinished`. |
| `MatchSide` | matchId, position (0\|1), entrantId?, sourceRef | `sourceRef` points at the feeding match so the bracket can render "Winner of QF2" before it's decided. |
| `Set` | matchId, index, side0Games, side1Games, side0TiebreakPoints, side1TiebreakPoints | Tiebreak points nullable. |
| `Standing` | groupId, entrantId, computed stats | Derived, materialized for fast reads. |
| `Court` | tournamentId, name, surface | For scheduling and the "where" question. |
| `ScoreEvent` | matchId, actorId, payload, createdAt | Append-only audit log. Enables undo and conflict resolution. |

### 4.1 Identity model: only admins have accounts

**Players are records, not users.** Nobody but an administrator ever authenticates. This is the normal arrangement at club level rather than an unusual one — Challonge's participants are plain strings, and the heavyweight federated tools (USTA TennisLink, tournamentsoftware.com) only require player accounts because they feed national ranking systems. With no ratings and no rankings (§1), the main reason for player accounts disappears.

| Who | Authentication |
|---|---|
| Owner / admin | Real account, email + OAuth |
| Scorekeeper | Link-scoped token, no account, single tournament |
| Entrant | **Nothing.** A row in a table. |
| Spectator | **Nothing.** Public pages are open. |

#### What this costs, and how it's paid

Removing player accounts removes a login wall but transfers three jobs to the software:

**1. Identity is anchored to email, not to name.** Without accounts there's no login to anchor a person to, so **email address is the canonical identifier.** Every public registration requires one, and it must be unique within the organization. That single constraint replaces the entire fuzzy-matching problem: "Mike Smith" and "Michael Smith" with the same email are provably one person, and with different emails they are treated as two until an admin says otherwise.

- **Required at registration**: first name, last name, email, phone. All four. Names are two separate required fields so the directory is sortable and searchable by surname — a single "full name" box produces "Priya Raman", "raman, priya" and "P Raman" in the same column within a week.
- **Email is unique per organization.** A second registration with a known email resolves to the existing `Player` and adds an `Entrant` row, rather than creating a new person. This is how a returning player's cross-event page (§6.4) stays whole across seasons.
- **No automated name matching.** No Levenshtein, no nickname dictionary, no "Did you mean…?" prompts. Similar names are shown plainly in the directory and the review queue, sorted so near-matches sit adjacent, and the admin notices or doesn't. **Nothing is ever blocked on a name.** An admin who wants two Mike Smiths in the same draw gets two Mike Smiths.
- **Manual merge tool**, retained for the one case uniqueness can't catch: a real person who registers under two different email addresses. Pick the canonical record, reassign every `Entrant` row, reversible via an audit entry. Admin-initiated only — never suggested, never automatic.

**Where uniqueness has to bend:** households share email addresses. A parent registering two juniors, or a couple with one address, is common at club level and a hard unique constraint would simply lock them out. So the constraint applies to the **public form only**. Admin-created players may have a duplicate email or none at all — an admin typing someone in from a paper sheet is making a judgment the form can't. The form says "that email is already registered — ask your organizer to add you" rather than inventing a bypass that bots can use.

The directory compounds across seasons. By season three it's effectively the club's member list, keyed on email, which turns the main cost of having no accounts into one of the product's more valuable assets.

**2. Nobody can correct their own data.** A misspelled surname stays misspelled until an admin fixes it. Name editing must therefore be fast and available from everywhere a name appears — including from the bracket itself, not buried in a settings screen.

**3. Contact details belong to people who never signed up here.** Email and phone are collected so an organizer can reach entrants, and they stay **admin-only** — never rendered on a public page, never in an API response served to an unauthenticated request, never in an OG image. Names and club affiliation are public (brackets have always worked this way); contact information is not. Since there is no per-player display flag, honoring a removal request means an admin editing or deleting that entrant record, which is a thing support will eventually be asked to do.

Junior entrants are handled identically to everyone else — no age field, no junior flag, no differentiated storage.

### 4.2 Public entry form

A form is not an account — no password, no session, no login. The form is the enrollment mechanic that makes category self-selection work without player accounts.

- **Per-tournament toggle**, plus an open/close state independent of it. An admin can halt entries instantly without deleting anything.
- Route: `/t/:tournament/enter`.
- **Fields**: first name *(required)*, last name *(required)*, email *(required, unique)*, phone *(required)*, club *(optional)*, and one or more category × discipline selections. Someone entering B Singles and C+ Doubles submits once.
- Name fields validate only that they are non-empty and within length caps. No pattern matching on the *shape* of a name — no "must contain a capital", no rejecting hyphens, apostrophes, accents, or single-character parts.
- **Partner handling**: the submitter supplies their partner's **email** (preferred, because it's the identity key) or just their name, or checks "my partner will enter separately."
  - Partner email matching an existing or pending registration → the pair is proposed to the admin, already linked.
  - Partner email not yet seen → held until that person registers, then auto-proposed.
  - Name only, or nobody → lands in the admin's unpaired-player tray (§5.2).
- **Every submission is `pending`.** It appears nowhere public until an admin accepts it. This is also the entire anti-abuse strategy's backstop: junk never reaches a bracket.
- **Email lookup at submit time** against the player directory. A known email resolves to the existing `Player` — the submission still needs approval, but the admin sees "returning player, 4 prior tournaments" rather than a stranger.

#### Abuse resistance without accounts

No login means no per-user rate limiting, so the gate has to be elsewhere:

- Honeypot field plus a minimum time-to-submit (a sub-2-second submission is a bot).
- Per-IP rate limit on the endpoint.
- Cloudflare Turnstile, toggleable per tournament — on by default for public tournaments, off for unlisted ones where the link was shared privately.
- Admin approval as the final gate, and a one-click "close entries" if a form gets hammered.
- Submissions are retained verbatim in `EntrySubmission` even after acceptance, so a flood can be audited and bulk-rejected.

#### Confirming a submission — no email, ever

**The product sends no email of any kind.** Email is collected purely as an identity key and as a way for an organizer to reach someone out-of-band from their own inbox. Nothing is ever dispatched by OpenTennis — no confirmations, no reminders, no notifications. This keeps the product out of deliverability, bounce handling, unsubscribe compliance, and the sender-reputation work that an email pipeline drags behind it.

What a submitter gets instead:

- A **confirmation page, not a toast.** It states plainly which draws they've entered and that an organizer still has to approve it.
- A **bookmarkable status URL** — `/t/:tournament/entry/:token` — reporting `pending` → `accepted`, and once accepted, linking straight to their player page and their first match.
- The page is built to be **screenshotted**, because that is what people will actually do with it. Tournament name, the entered draws, and the status URL as a scannable QR must all be legible in a single screen capture.

Since there's no email, the status URL and the public bracket are the only feedback channels. That raises the bar on the bracket being genuinely good — which it already needed to be.

### 4.3 Admin review queue

The counterpart to the form, and the screen an admin will actually live in during entry season:

- Submissions listed newest-first. Email lookup result shown inline: `returning · 4 prior tournaments` or `new to the club`. An exact fact, not a similarity score.
- Rows are **sorted so that near-identical names sit adjacent**, so two Mike Smiths land next to each other and an admin notices without the software asserting anything. Nothing is flagged, highlighted, or blocked.
- **Accept**, accept-with-edits, reject, or move to a different category — all single actions, all keyboard-driven. An admin clearing 60 submissions should never need the mouse.
- **Bulk accept** for the common case where everything is clean.
- Accepting creates or links a `Player`, creates the `Entrant` rows, and flips them to `active`.
- The category grid (§5.1) shows a pending count per cell, so an admin sees that C Doubles has 14 waiting without opening anything.

### 4.4 Distribution: QR codes and links

With no outbound email, **QR codes and social links are the only channels that reach a player.** That makes QR generation core infrastructure rather than a convenience feature, and it should be built at the same time as the entry form.

#### Generated targets

An admin can generate a QR for any of these, at the tournament level or **per event** — the per-event code is the one that gets pinned to a noticeboard:

| Target | Resolves to | Typical use |
|---|---|---|
| Tournament landing | `/t/:slug` | Social post, club newsletter |
| Entry form | `/t/:slug/enter` | "Sign up for the Autumn Open" |
| **Entry form, pre-filtered** | `/t/:slug/enter?c=c-plus&d=doubles` | Poster beside the C+ Doubles signup sheet — opens the form with that cell already selected |
| **A single draw** | `/t/:slug/c-plus/doubles` | Pinned by the court during play, scan to see the live bracket |

#### Requirements

- **Generated client-side.** No third-party QR service, so no entrant-facing URL ever leaves the browser, there's no external dependency to rot, and it works with the venue's wifi down.
- **Error correction level Q.** These get printed, taped to a clubhouse wall, and photographed at an angle in bad light. The extra redundancy is worth the density.
- **Quiet zone preserved, no logo in the center.** A branded QR that fails to scan in a dim corridor has cost the tournament an entrant. Branding goes around the code, never inside it.
- **Download as SVG and PNG.** SVG for print, PNG at 1080px for Instagram and WhatsApp.
- **Short, readable slugs.** Someone will read a URL aloud or type it from a poster, so `/t/autumn-open-26` beats a UUID. Tournament slugs are admin-editable and must be short enough to say out loud. They are **globally unique**, not per-organization — see §9.1 for why that matters to every printed code.
- **Printable QR sheet** (see §5.7): the code plus tournament name, category chip, discipline, format, and a "Scan to enter" line. One per page, or 4-up for a noticeboard of every category at once.
- **Social card variant**: a square image with the QR, tournament name, and dates, sized for a feed post.

#### Printed codes outlive the thing they point at

A poster stays on the wall after entries close and after the tournament ends. So:

- A QR to a closed entry form resolves to a page that says **"Entries are closed"** and links to the bracket. Never a 404, never an error.
- A QR to a finished tournament resolves to the final results. The slug is permanent for the life of the tournament and is never reused.
- Optional light attribution: each generated code can carry a `?src=` label the admin names ("clubhouse-board", "instagram"), so they can tell which poster actually worked. Counted, not tracked — no cookies, no cross-site identifiers.

### Two architectural decisions worth stating up front

**1. The engine is a pure package.** All draw generation, standings computation, and tiebreaker resolution lives in `@opentennis/engine` — a framework-free, dependency-free, fully deterministic TypeScript package with no database or network access. Input: entrants + config. Output: matches + structure. This makes the hardest logic in the product exhaustively unit-testable and keeps tournament correctness independent of the web layer.

**2. `MatchSide.sourceRef` over eager population.** Bracket slots reference their feeding match rather than waiting for an entrant. The full bracket structure exists the moment the draw is generated, which is what makes the public bracket renderable, animatable, and shareable before a single ball is hit.

---

## 5. Admin panel requirements

### 5.1 Tournament setup

- Create tournament: name, venue, date range, timezone, visibility (`draft` / `unlisted` / `public`).
- Add courts with names and surfaces.
- Organization branding: logo, one accent color override, custom public slug.

#### The category grid

The central setup screen. Categories down the left, disciplines across the top, one toggle per cell. Toggling a cell on creates an `Event`; each cell then carries its own format and scoring config.

```
                    SINGLES              DOUBLES
  Open         ☑ Round robin   ▾    ☑ Round robin   ▾
  A            ☑ Round robin   ▾    ☑ Round robin   ▾
  B            ☑ Round robin   ▾    ☐ —
  C+           ☑ Single elim   ▾    ☑ Single elim   ▾
  C            ☑ Single elim   ▾    ☑ Single elim   ▾
  D            ☑ Single elim   ▾    ☐ —
                                      ⌄ bulk: set all singles to…
```

Requirements:

- **Defaults are pre-filled, not imposed.** New tournaments open with Open/A/B on round robin and C+/C/D on single elimination, every cell enabled. The admin unchecks what they aren't running and changes any format they like. A tournament that is nothing but D Doubles is valid.
- **Per-cell config** behind the format dropdown: scoring format, double round robin, group count and qualifiers for hybrid, third-place playoff, `minEntrants`.
- **Bulk actions**: set a whole column or row at once. An admin running eight events should not configure scoring eight times.
- **Save as a template.** Clubs run the same grid every season. One-click "same as last time" is the single highest-leverage feature in the admin panel, and it only works because the grid is structured data rather than typed event names.
- **Copy from a previous tournament**, which brings the grid and the per-cell config but never the entrants.

### 5.2 Entrant management

Entrants are managed **per event** — the grid is also the navigation for entry lists, showing live entrant and pending counts per cell, so an admin sees at a glance that B Doubles has three people and C Doubles has fourteen waiting for review.

Three intake paths, all landing in the same place:

1. **Public entry form** → review queue → accepted (§4.2, §4.3)
2. **Paste or CSV import** by an admin, from a paper sheet or email thread
3. **Manual single add**, for the person who turns up on the day

<!-- -->

- **Add players** manually, or paste a list (one per line, `First Last`, optionally `, Club`) and get a parsed preview before commit. CSV import with column mapping.
- Every path runs the §4.1 duplicate check against the org player directory before committing.
- **Players are reusable across events.** The same person entering C+ Singles and C+ Doubles is one `Player` with two `Entrant` records. Entering them twice must be prevented by a duplicate check on name within the organization, with a merge prompt.
- **Doubles pairing**: drag two players together to form a team, or paste `Player A / Player B` per line. Unpaired players sit in a visible "needs partner" tray. A team belongs to exactly one category — there is no partner-eligibility rule to enforce.
- **Moving entrants between categories** is a first-class action, available before the draw is generated. Someone signs up for C and the admin thinks they belong in C+; it's a drag between cells. Post-generation it requires regenerating the affected draws, and says so.
- **Seeding is manual.** Drag to order, seeds 1..n, with a visible divider marking where seeding stops and the unseeded field begins. Alternatively choose **unseeded random draw** — a plain toggle, not a hidden setting. There is no rating to auto-seed from, so neither option is the "real" one.
- Mark entrants withdrawn before or after draw generation (post-draw withdrawal behavior specified in §3.6 of the formats spec).

### 5.2 Entrant management

- **Add players** manually, or paste a list (one per line, `First Last`, with optional `, rating`) and get a parsed preview before commit. CSV import with column mapping.
- **Doubles pairing**: drag two players together to form a team, or paste `Player A / Player B` per line. Unpaired players sit in a visible "needs partner" tray.
- **Seeding**: auto-seed by rating, or drag to reorder. Seeds 1..n, unseeded below the line. A visible divider marks where seeding stops.
- Mark entrants withdrawn before or after draw generation (post-draw withdrawal behavior specified in §6.4 of the formats spec).

### 5.3 Draw generation

- Preview the draw before committing. Generation is **idempotent given a seed value** — the same inputs produce the same draw, and the random seed is stored so a draw can be reproduced or audited.
- Show bye placement explicitly. Byes are a frequent source of organizer distrust; they must be visibly justified ("Seeds 1–4 receive byes").
- Regenerate is allowed while the event is in `draft`. Once `published`, the structure locks and changes require an explicit, logged override.
- Manual override: an admin can drag an entrant into a specific slot. Doing so flags the draw as `manuallyAdjusted` for transparency.
- Draws are generated **per event, independently**. The grid shows generation state per cell. A "generate all ready draws" bulk action exists, but each draw remains individually regenerable.

#### Under-filled categories

A category that doesn't attract enough entrants is **not** handled automatically. No merging, no collapsing into an adjacent tier, no auto-cancellation. The admin simply doesn't generate that draw and tells the entrants there weren't enough people.

What the software owes them is only this:

- A **soft flag** on the grid cell when entrant count is below that event's `minEntrants` (default 4, per-event editable). It's an advisory marker, never a block — an admin who wants to run a 3-person round robin just generates it.
- An event status of **`notRun`**, set manually, distinct from `draft`. It means "we decided not to hold this."
- `notRun` events are **hidden from the public site by default**, with an option to show them labeled "Not held — insufficient entries" so entrants who registered aren't left wondering.
- A **contact list export** for the affected entrants (names and emails), so the admin can send that message from their own email. OpenTennis does not send it — see §2 non-goals.

The failure mode to avoid is a system that silently reshuffles someone's category. An organizer's credibility with their members depends on them being the one who communicates the change.

#### Event status model

| Status | Meaning |
|---|---|
| `draft` | Accepting entrants, no draw. Structure freely editable. |
| `ready` | Entry closed, draw not yet generated. |
| `published` | Draw generated and publicly visible. Structure locked. |
| `inProgress` | At least one match has a result. |
| `complete` | All matches resolved, champion known. |
| `notRun` | Insufficient entries or cancelled. No draw, never will be. |

### 5.4 Score entry

This is the feature most likely to be used badly if designed badly. Requirements:

- **Stepper-first.** Games are entered with +/− steppers sized for a thumb, never a text input. Tiebreak points get a numeric keypad only when the set reaches 6–6.
- **Validation against the scoring format.** The UI refuses impossible scores (7–4 in a standard set, a third set when the match is already 2–0 in a best-of-three). Invalid states are unreachable, not error-flagged.
- **Live mode.** Optional point-by-point or game-by-game entry that streams to the public page. Falls back to final-score-only entry.
- **Non-standard outcomes** are first-class, not an afterthought: retirement (with the score at the time), walkover, default, and unfinished.
- **Idempotent submission.** Every score carries a client-generated event ID so a retried request can't double-apply. This is not about offline support (there is none — §2); it's about double-taps and ordinary network retries, which happen on a good connection.
- **Undo.** The last score action is reversible from the match view, backed by the `ScoreEvent` log.

### 5.5 Scheduling

- Assign matches to courts and time slots via a drag-to-court day view.
- Conflict detection: same entrant in two overlapping matches, same court double-booked, a player scheduled with less than *n* minutes of rest.
- **Conflict detection is load-bearing, not advisory**, because a player may enter any number of draws — including two categories in the same discipline (§12). Someone in C+ Singles, C Singles, and C+ Doubles has three independent draws progressing at once, and nothing in the draw generators knows about the other two. The scheduler is the only place that collision is visible, so it has to span every event in the tournament rather than working per draw.
- Rest-time conflicts matter more than double-bookings in practice: a double-booking is obvious, whereas being due on court 4 eight minutes after finishing a three-setter on court 9 is the thing that actually goes wrong.
- "Next up" queue per court for a call-to-court display.

### 5.6 Roles & permissions

| Role | Capabilities |
|---|---|
| `owner` | Everything, including org settings and the category ladder |
| `admin` | Full tournament management, including the entry review queue |
| `scorekeeper` | Enter and edit scores only; no draw, entrant, or submission changes |
| `viewer` | Read-only access to unpublished tournaments |

There is deliberately **no player role** — see §4.1.

Scorekeepers are invited by link with no account creation, scoped to a single tournament. The volunteer-parent persona will not create an account, and requiring one means scores get texted to the director instead. Tokens are revocable and expire with the tournament.

### 5.7 Output

- Printable draw sheet (PDF, standard bracket layout, fits A4/Letter).
- Printable match slips.
- **Printable QR sheet** per tournament or per event (§4.4) — code, category chip, discipline, format, "Scan to enter". One per page, or 4-up to put every category on one noticeboard page.
- CSV export of results, and of the entrant contact list.
- Auto-generated share card (OG image) per event and per match, plus a square QR card sized for a social feed.

---

## 6. Public site requirements

Unauthenticated, fast, and built for a phone held in one hand.

### 6.1 Tournament landing

- Hero: tournament name, venue, dates, live-match count.
- **The category grid is the primary navigation**, mirroring the admin's setup grid — categories down, Singles/Doubles across, each live cell showing entrant count, format, and status. A spectator's first question is "where's the C+ draw?" and the answer should be one tap, visible without scrolling.
- Categories render in ladder order (`rank`), never alphabetically. `Open` above `A` above `B` above `C+` matters; an alphabetical sort putting `A, B, C, C+, D, Open` would read as broken to anyone who plays.
- `notRun` cells are hidden by default, or shown greyed with "Not held" if the admin enabled it.
- If any match is live, a persistent live strip surfaces it with its category labeled — on a busy Saturday there may be six draws running at once, and a score with no category attached is noise.

### 6.1a URL structure

Category and discipline are in the path, because these links get pasted into group chats and should be readable:

```
/t/riverside-autumn-2026                       landing, category grid
/t/riverside-autumn-2026/c-plus/doubles        the draw
/t/riverside-autumn-2026/c-plus/doubles/m/18   a match, bracket focused on it
/t/riverside-autumn-2026/p/priya-raman         a player across all their events
```

Category codes slugify predictably (`C+` → `c-plus`). The slug is stable for the life of the tournament.

### 6.2 Bracket view (single elimination)

Three rendering modes, switchable, with the default chosen by viewport:

| Mode | Default at | Description |
|---|---|---|
| **Full bracket** | ≥1024px | Classic left-to-right bracket, pan and pinch-zoom, inertial. Minimap for draws ≥32. |
| **Round column** | <640px | One round at a time, horizontal snap-scroll, sticky round tabs. |
| **Path view** | on demand | Pick an entrant, see their vertical route to the final — played matches resolved, future matches as "Winner of …". |

Bracket requirements:

- Undecided slots render their `sourceRef` ("Winner of QF2"), never an empty box.
- Seeds shown as superscript next to names. Byes labeled, not blank.
- Live matches carry the live treatment (see design system — optic yellow, reserved).
- Tapping a match opens a detail sheet: set-by-set score, court, time, head-to-head if prior meetings exist in the system.
- Deep-linkable per §6.1a — the match URL opens the bracket already focused on that match.
- A persistent category switcher stays available inside a draw, so moving from C+ Singles to C+ Doubles doesn't mean going back to the landing page.

### 6.3 Standings view (round robin)

- Table: entrant, matches W–L, sets W–L, games W–L, points, and a results grid.
- The **results grid** (crosstab of every entrant against every other) is the format's signature object and must be rendered properly — on mobile it becomes a horizontally scrollable matrix with a sticky first column.
- Qualification line drawn visibly when the group feeds a playoff stage.
- Tiebreaker reasoning is *shown*: tapping a tied pair explains why one is ranked above the other. This removes the single most common source of organizer disputes.

### 6.4 Player view

- Search entrants across the whole tournament, not per draw — people know a name, not a category.
- Per-player page spans **every event they're in**. Priya playing B Singles and C+ Doubles gets one page with both, because her actual question is "when do I play next," and the answer might be in either draw. This is the main reason `Player` is distinct from `Entrant`.
- Next match prominent, with court and time. Then results and path-to-final per event.
- Partner shown and linked for doubles entries.

### 6.5 Live behavior

- Server-sent events push score changes. No polling, no manual refresh.
- Score changes animate in place (see Score Tick, design system §5).
- A match completing triggers the Advance Line animation into the next round.
- Connection loss shows an honest indicator and reconnects with backoff.

---

## 7. Format specifications

Full algorithmic detail — seeding order, bye assignment, circle-method scheduling, tiebreaker cascades, scoring formats, and retirement handling — is specified in **[`docs/tournament-formats.md`](docs/tournament-formats.md)**. Summary of what v1 must support:

- **Single elimination**: power-of-two bracket with byes to top seeds, standard mirrored seed placement, optional third-place playoff.
- **Round robin**: single or double round robin, circle-method round scheduling, ITF/USTA-aligned tiebreaker cascade, correct handling of incomplete groups.
- **Hybrid**: *n* round robin groups → single elimination playoff, with configurable qualifiers per group and cross-group seeding of the playoff draw.
- **Scoring formats**: best-of-3 sets, best-of-5 sets, best-of-3 with match tiebreak in the deciding set, pro set to 8, single set to 6, with ad/no-ad and tiebreak-at-6-6 or at-8-8 variants.

---

## 8. Design requirements

The brief is that this must not look generated. That's a real, specifiable requirement, so it's specified — **[`docs/design-system.md`](docs/design-system.md)** carries the full art direction, tokens, motion spec, and an explicit banned-patterns list. The essentials:

### Art direction: *Court Lines*

Tennis already owns one of the strongest visual languages in sport: a painted white line on a colored surface, and one optic-yellow ball. The system derives from **surface, line, and ball** — nothing else. Depth comes from line weight and surface tint, not from drop shadows. Two border radii exist in the entire product. Optic yellow is reserved exclusively for *live right now* and is never decorative.

### Motion

Nine named, specified motions rather than ad-hoc transitions — Draw Reveal, Score Tick, Advance Line, Live Pulse, Bracket Pan, Shared Element, Standings Reorder, Champion Reveal, Court Loader. Each has a defined duration, easing, and trigger. All respect `prefers-reduced-motion`. Only compositor-friendly properties are animated.

### Hard constraints

- No layout shift after first paint (CLS < 0.05). Skeletons match final geometry exactly.
- Bracket pan/zoom holds 60fps on a 2021-era mid-range Android.
- All numerals tabular, always. A score that reflows when it changes is a bug.
- Every interactive target ≥44×44px.
- WCAG 2.2 AA: contrast, focus visibility, full keyboard navigation of the bracket (arrow keys traverse rounds and slots), screen-reader-sane bracket semantics.

---

## 9. Technical architecture

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router), TypeScript strict | Server components make public bracket pages cheap and fast; one codebase for both faces. |
| Engine | `@opentennis/engine` — pure TS workspace package | Deterministic, testable, portable. No DB or framework imports. |
| Database | Postgres (Neon) + Drizzle ORM | Relational data with real constraints; the domain model is unapologetically relational. |
| Auth | Better Auth, email + OAuth | Needs link-scoped tokens for passwordless scorekeepers. |
| Styling | Tailwind v4 with a custom token layer | Stock palettes and default radii are banned; tokens come from the design system. |
| Animation | Motion (Framer Motion) + View Transitions API where supported | Layout/FLIP animation and shared elements are core, not decorative. |
| Realtime | Postgres `LISTEN/NOTIFY` → SSE | Score updates are low-frequency and unidirectional. Websockets are unnecessary complexity. |
| Bracket render | SVG for ≤32 draws; SVG + offscreen round virtualization for 64+ | Keeps DOM node count sane and pan on the compositor. |
| QR generation | Client-side library, no service | No entrant URL leaves the browser; no external dependency to rot (§4.4). |
| Hosting | Vercel | ISR for public pages, edge for share-card generation. |

### 9.1 Single tenant now, multi-tenant still reachable

v1 serves **one organization.** No signup flow, no org switcher, no org picker — the single org is seeded at deploy and hardcoded in config. But multi-tenancy must not be designed out, so five disciplines apply from the first commit. None of them cost anything today.

1. **`organizationId` exists on every table that would need it** — tournaments, players, categories, users — and is populated, even though there's exactly one value. Backfilling a tenant column into a live schema is tedious; having it unused is free.
2. **Every query filters on it.** Not "there's only one org so skip the where clause." The filter goes in from day one, ideally enforced at the data-access layer rather than remembered at each call site. This is the discipline that actually matters: a missing `where orgId = ?` is the standard multi-tenant data leak, and adding them retroactively across a whole codebase is how that bug gets shipped.
3. **No global uniqueness assumptions except the one below.** Category codes are unique *per org*, player emails unique *per org* (§4.1), court names unique *per tournament*.
4. **Tournament slugs are globally unique**, deliberately — see below.
5. **The single org's identity lives in config, not in code.** Branding, name, and category ladder come from the database row, so a second org is a row insert rather than a refactor.

#### Why tournament slugs must be globally unique from day one

This one is easy to get wrong and expensive to fix, and it's a direct consequence of the QR decision in §4.4.

Public URLs are `/t/:slug`. If slugs were only unique per org, expanding to multi-tenant would force a path change — `/:org/t/:slug` or a subdomain — and **every printed QR code and poster already taped to a clubhouse wall would break.** The spec promises those codes keep working for the life of the tournament.

So: enforce global slug uniqueness now. It costs one unique index and an occasional "that name is taken, try `autumn-open-26-riverside`" during tournament creation. In exchange, `/t/:slug` never has to change, and printed artifacts survive any future expansion. If per-org subdomains are ever wanted, they can be added as an *additional* way in while the apex path keeps resolving.

### Rendering strategy

Public bracket pages are statically generated and revalidated on result changes, then hydrated with an SSE subscription only when the event has live matches. A completed tournament's bracket should be a static document that costs nothing to serve — these pages get linked in group chats and will see spiky traffic.

### API surface (sketch)

```
GET  /api/t/:tournament                              category grid + per-event status
GET  /api/t/:tournament/:category/:discipline        full structure + results
GET  /api/t/:tournament/:category/:discipline/table  standings + tiebreaker trace
GET  /api/t/:tournament/player/:playerId             all events for one player
GET  /api/t/:tournament/live                         SSE stream, all draws, category-tagged

POST /api/t/:tournament/enter                        public form submission — rate-limited,
                                                     Turnstile-gated, always lands as pending
GET  /api/t/:tournament/entry/:token                 submission status, no auth, token-scoped

GET  /api/admin/tournaments/:id/submissions          review queue
POST /api/admin/submissions/:id/accept               accept, optionally with edits
POST /api/admin/submissions/:id/reject
POST /api/admin/submissions/bulk                     bulk accept / reject
POST /api/admin/players/:id/merge                    merge duplicate records, reversible
POST /api/admin/tournaments/:id/grid                 bulk create/update events
POST /api/admin/events/:id/draw                      generate draw (idempotent w/ seed)
POST /api/admin/events/:id/status                    set ready / published / notRun
POST /api/admin/entrants/:id/move                    move entrant to another event
POST /api/admin/matches/:id/score                    submit score (idempotent w/ clientEventId)
POST /api/admin/matches/:id/undo                     revert last score event
```

Score submission is idempotent on a client-generated event ID so the offline queue can retry safely.

**`POST /api/t/:tournament/enter` is the only unauthenticated write endpoint in the product.** Everything else public is read-only. That makes it the entire attack surface for anonymous writes and it should be treated accordingly: strict payload schema, length caps on every string, no HTML accepted anywhere, rate limiting, and the invariant that a submission can only ever create a `pending` row — never a `Player`, never an `Entrant`, never anything the public site renders. An admin action is always required to cross that boundary.

---

## 10. Milestones

| | Scope | Exit criteria |
|---|---|---|
| **M0** | Engine + schema | Single elim and round robin generation pass an exhaustive test suite for draw sizes 2–128; tiebreaker cascade verified against published ITF examples. |
| **M1** | Admin core + category grid | Dana can create a tournament, enable 8 cells across 6 categories × 2 disciplines, paste entrants into each, and generate all draws. Template save/reuse works. Player directory keyed on email, with manual merge. |
| **M1.5** | Entry form + review queue + QR | A player scans a poster QR, lands on the form with C+ Doubles pre-selected, and submits with no account. Dana clears 60 submissions from the keyboard in under five minutes. Printable 4-up QR sheet for the noticeboard. |
| **M2** | Public bracket + design system | Bracket renders in all three modes; tokens and motion primitives implemented; passes the §8 hard constraints. |
| **M3** | Scoring + live | Marco can enter a full match score one-handed; Sam sees it update without refreshing. |
| **M4** | Round robin + hybrid | Standings with visible tiebreaker reasoning; groups feed a playoff draw. |
| **M5** | Motion polish | All nine named motions implemented; Champion Reveal; share cards. |
| **M6** | Scheduling + multi-event | Court assignment with conflict detection; a tournament runs 4 concurrent events. |

Neither doubles nor categories are milestones. Doubles is a property of `Entrant`; category is a column on `Event`. Both must work from M1 or the model is wrong.

---

## 11. Success metrics

- Time from tournament creation to published draw: **< 10 min** (p50)
- Score entry time per completed match: **< 20s** (p50)
- Public bracket LCP on 4G mobile: **< 1.5s**
- Draw regenerations per tournament: **< 1.2** (a proxy for whether organizers trust the first draw)
- Share-link opens per entrant: **> 8** (a proxy for whether the public page is worth opening twice)
- Entrants arriving via the public form rather than admin typing: **> 70%** (the whole point of §4.2)
- Submission review throughput: **< 5s per submission** (p50)
- Manual player merges per 100 entries: **< 2** (the residual identity cost after email uniqueness — one person with two addresses)
- Entry-form completion rate once opened: **> 75%** (four required fields is real friction; if this sags, phone is the field to question)
- Share of entries arriving from a QR scan: tracked, no target — it's the signal for whether printed codes or social links are doing the work

---

## 12. Open questions

### Resolved

- ✅ **Category ladder** — `Open, A, B, C+, C, D`, org-level, admin-editable. Format defaults to round robin for Open/A/B and single elimination for C+/C/D, overridable per cell.
- ✅ **Skill ratings** — the product has none. Players self-select their category.
- ✅ **Eligibility rules** — none. Nothing validates or blocks a category choice, in singles or doubles.
- ✅ **Under-filled categories** — no automation. Admin marks the event `notRun` and communicates it themselves.
- ✅ **Doubles categories** — a team enters one category; both partners are understood to be in it. No partner-rating rule.
- ✅ **Player accounts** — none. Only admins authenticate; entrants are records. Scorekeepers get link-scoped tokens. See §4.1.
- ✅ **Public self-registration** — yes, as an optional per-tournament **form** with mandatory admin approval. A form is not an account. See §4.2, §4.3.
- ✅ **Public name display** — full names always, no per-player opt-out. Contact details stay admin-only.
- ✅ **Entry fees** — out of v1 entirely. No payment processing ever; fee *tracking* is parked in [`docs/entry-fees-deferred.md`](docs/entry-fees-deferred.md).
- ✅ **Who enters scores** — organizers and scorekeepers only. Settled as a consequence of having no player accounts: there is no authenticated identity to attribute a player's self-reported score to, and building per-match capability links just for that isn't worth the dispute surface.
- ✅ **Identity resolution** — email is the canonical key, unique per org on the public form. Name, email, and phone all required at registration. **No automated name matching and nothing blocked on a name** — similar names sort adjacent and the admin notices manually. Manual merge retained for one person with two emails.
- ✅ **Outbound email** — none, ever. Not even a submission confirmation. Collected addresses are an identity key and an organizer's contact list, nothing more.
- ✅ **Distribution** — QR codes (generated per tournament and per event) plus social links. No email channel exists, which makes §4.4 core infrastructure.
- ✅ **Minors** — no special handling. Identical storage and display to adults.

### Still open

- ✅ **Consolation draws** — not in v1, kept in the bag. Design parked in [`docs/consolation-draws-deferred.md`](docs/consolation-draws-deferred.md), which also lists the three cheap guardrails v1 must respect so it stays inexpensive later. Note: an earlier draft overstated the cost of deferring this — the `loserOf` source reference needed for consolation is already in the v1 model for the third-place playoff.
- ✅ **Mixed doubles** — not in v1. `discipline` stays a two-value enum (`singles | doubles`). Adding a third value later is an enum migration plus a third grid column; low risk, and not worth carrying the complexity now.
- ✅ **Multi-tenancy** — single tenant at launch, but never foreclosed. See §9.1 for the specific disciplines that keep expansion reachable.
- ✅ **One player, two categories, same discipline** — allowed. Someone wanting both C+ Singles and C Singles gets both, with no warning and no block. Feeds the scheduler's conflict detection (§5.5), which becomes load-bearing as a result.
- ✅ **Offline support** — none. The venue has reliable signal, so the IndexedDB write queue and sync indicator are cut from the spec entirely. Score submission keeps its idempotency key regardless: that defends against double-taps and ordinary request retries, which happen on a good connection too.

### Still open

1. **Per-cell third-place playoff default** — on for the elimination categories, off elsewhere? Varies sharply by region and level. Deliberately left pending; it's a default value, changeable the day before a tournament, and nothing else depends on it.
