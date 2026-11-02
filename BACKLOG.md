# OpenTennis — Backlog

**Generated:** 2026-11-02 from `PRD.md`, `docs/tournament-formats.md`, `docs/design-system.md`

## Progress

**Engine + schema complete.** 410 tests passing (360 engine · 50 db). Engine at 100% statements/lines/functions across all 11 modules, 96.1% branches.

| Done | Task | Commit |
|---|---|---|
| ✅ | INF-1 — pnpm monorepo, Next 15 App Router, TS strict, Vercel config | `fcb83e0` |
| ✅ | ENG-1 — `@opentennis/engine` scaffold + core types | `aa3a5a6` |
| ✅ | ENG-2 — seeded PRNG, shuffle, test fixtures | `ffec989` |
| ✅ | ENG-3 — bracket sizing, seed placement, bye math, round naming | `1cc8893` |
| ✅ | ENG-4 — single-elimination generation, three seeding modes | `b45e4bd` |
| ✅ | ENG-5 — round naming *(folded into ENG-3/4)* | `1cc8893` |
| ✅ | ENG-6 — third-place playoff, config-gated | `e223e45` |
| ✅ | ENG-7 — bracket geometry: node rects, connector paths, canvas size | `6a0b948` |
| ✅ | ENG-8 — round robin, circle-method scheduling, double RR | `70fb6f4` |
| ✅ | ENG-14 — scoring presets, set validation, match summarisation | `d800472` |
| ✅ | ENG-9 + ENG-15 — standings with non-standard outcomes | `0396a54` |
| ✅ | ENG-10 — tiebreaker cascade with trace output | `1becbb8` |
| ✅ | ENG-11 — incomplete round robin withdrawal handling | `a96d98e` |
| ✅ | ENG-12 + ENG-13 — hybrid groups to playoff, cross-group ranking | `574da81` |
| ✅ | ENG-16 — consolidated matrix + end-to-end event simulations | `4c175cc` |
| ✅ | DB-1 — Neon + Drizzle + migration tooling | pending |
| ✅ | DB-2 — core schema: Organization, Category, Tournament, Event, Player, Entrant | pending |
| ✅ | DB-3 🔒 — tenancy enforced at the data-access layer | pending |
| ✅ | DB-4 🔒 — globally unique tournament slugs | pending |
| ✅ | DB-5 🔒 — draw structure, `Stage` as a real table | pending |
| ✅ | DB-6 — `ScoreEvent` append-only log | pending |
| ✅ | DB-7 — `Standing` materialisation columns | pending |
| ✅ | DB-8 — `EntrySubmission` + scorekeeper tokens | pending |
| ✅ | DB-9 — seed script, default `Open/A/B/C+/C/D` ladder | pending |

### Three spec bugs found by implementing

1. **`seedOrder` mirror value** (`formats §2.2`) — had `order.length * 4 + 1`, must be `* 2 + 1`. Produced a wrong draw at *every* size. Caught by asserting `seedOrder(4) === [1,4,2,3]`.
2. **Connector model** (`formats §2.7`) — specified one shared path per sibling pair, which makes the per-child Advance Line animation impossible. Now one path per child.
3. **ENG-14 ordering** — standings cannot decide set completeness without the scoring format, so ENG-14 had to land before ENG-9. Backlog order was wrong.

### Next up

Engine and schema are both done. The critical path continues at **DES-1 → DES-4 → DES-6** (token layer, match node, category grid), then **INF-2** (auth) unblocks the whole ADM epic.

**Needs you:** `migrations/0000_*.sql` is generated and committed but has never been applied — there is no Neon database yet. To stand one up: create a project at neon.tech, put the connection string in `.env.local` (see `.env.example`), then `pnpm --filter @opentennis/db migrate` and `pnpm --filter @opentennis/db exec tsx src/seed.ts "Your Club Name"`. The seed prints the `OPENTENNIS_ORG_ID` to add to your env.

Sizes are relative, not commitments: **S** < 1 day · **M** 1–3 days · **L** 3–8 days · **XL** 8+ days.
🔒 marks a **guardrail** — cheap now, expensive to retrofit. Don't let these slip.

---

## Critical path

The shortest route to something real, in order. Everything else can be scheduled around it.

```
ENG-1 → ENG-2 → ENG-4 ─┐
                        ├→ DB-5 → ADM-11 → PUB-3 → SCR-1
DB-1 → DB-2 → DB-3 ─────┘
         ↓
      DES-1 → DES-4 → DES-6
```

Two things to do before anything else, because they constrain everything downstream: **DB-3** (tenancy filter at the data layer) and **DB-4** (global slug uniqueness). Both are small. Both are painful later.

---

## Epic: ENG — Draw engine

Pure TypeScript package, no DB, no framework, no network. Tests written before implementation.

| ID | Task | Size | Depends on |
|---|---|---|---|
| ENG-1 | Scaffold `@opentennis/engine` workspace package — TS strict, zero runtime deps, vitest | S | — |
| ENG-2 | Test harness, fixture loader, seeded-PRNG determinism assertions | S | ENG-1 |
| ENG-3 | `seedOrder(size)`, bracket sizing, bye-count math | S | ENG-2 |
| ENG-4 | Single-elimination generation — all three seeding modes (unseeded / partial / full) | L | ENG-3 |
| ENG-5 | Round naming derived from distance-to-final | S | ENG-4 |
| ENG-6 | Third-place playoff, config-gated | S | ENG-4 |
| ENG-7 | Bracket geometry — node coordinates, connector path segments | M | ENG-4 |
| ENG-8 | Round robin match set + circle-method round scheduling | M | ENG-2 |
| ENG-9 | Standings computation — matches, sets, games, points | M | ENG-8 |
| ENG-10 | **Tiebreaker cascade + trace output** — the 2-way/3-way asymmetry | L | ENG-9 |
| ENG-11 | Incomplete round robin — withdrawal under/over half-complete branches | M | ENG-10 |
| ENG-12 | Hybrid — group assignment (snake + unseeded), playoff draw, no same-group R1 rematch | L | ENG-4, ENG-8 |
| ENG-13 | Cross-group ranking correction for unequal group sizes | M | ENG-12 |
| ENG-14 | Scoring format presets + set-validation predicate | M | ENG-2 |
| ENG-15 | Non-standard outcomes (ret / w-o / def / unfinished) in standings math | M | ENG-9, ENG-14 |
| ENG-16 | Exhaustive matrix — N=2..128 × 3 seeding modes, ITF tiebreaker fixtures, small-field N=2–5 | L | ENG-4, ENG-10 |

**ENG-10 is the highest-risk item in the project.** Head-to-head applies *before* percentages for two tied entrants and *after* for three or more. That asymmetry is in the real rules and is where the bug will be. Encode the published ITF worked examples as fixtures before writing the implementation.

**ENG-16 note:** run unseeded and small-field cases first, not last. Most draws will have no seeds, and a 3-entrant Open round robin is the realistic case, not the edge case.

---

## Epic: DB — Schema & data layer

| ID | Task | Size | Depends on |
|---|---|---|---|
| DB-1 | Postgres (Neon) + Drizzle + migration tooling | S | — |
| DB-2 | Core schema — Organization, Category, Tournament, Event, Player, Entrant | M | DB-1 |
| DB-3 | 🔒 **Tenancy discipline** — `organizationId` on every table, filter enforced *at the data-access layer* | M | DB-2 |
| DB-4 | 🔒 **Globally unique tournament slugs** — unique index + collision UX at creation | S | DB-2 |
| DB-5 | 🔒 Draw structure — Stage, Group, Round, Match, MatchSide, Set. **Stage stays a real table with its own identity** | M | DB-2 |
| DB-6 | `ScoreEvent` append-only log | S | DB-5 |
| DB-7 | `Standing` materialization + recompute on result change | M | DB-5 |
| DB-8 | `EntrySubmission` | S | DB-2 |
| DB-9 | Seed script — single org, default `Open/A/B/C+/C/D` ladder | S | DB-2 |

**DB-3**: a missing `where orgId = ?` is the standard multi-tenant data leak. Enforce it once in the data layer rather than remembering it at every call site.
**DB-4**: protects every printed QR code from a future URL change (PRD §9.1).
**DB-5**: collapsing `Stage` into an enum on `Event` forecloses consolation draws. See `docs/consolation-draws-deferred.md` §4.

---

## Epic: INF — Platform

| ID | Task | Size | Depends on |
|---|---|---|---|
| INF-1 | Next.js App Router scaffold, TS strict, lint + format | S | — |
| INF-2 | Auth (Better Auth) — admin accounts, `owner`/`admin`/`scorekeeper`/`viewer` roles | M | DB-2 |
| INF-3 | Scorekeeper link tokens — issue, scope to tournament, revoke, expire | M | INF-2 |
| INF-4 | Vercel deploy, environments, preview deploys | S | INF-1 |

---

## Epic: DES — Design system

| ID | Task | Size | Depends on |
|---|---|---|---|
| DES-1 | Token layer — color (light + dark), type scale, spacing, the two radii | M | INF-1 |
| DES-2 | Typography — Archivo variable + Instrument Sans, `tabular-nums` global on `:root` | S | DES-1 |
| DES-3 | Motion primitives — easings, durations, `prefers-reduced-motion` guard | S | DES-1 |
| DES-4 | **Match node component** — score columns, seed superscript (often absent), left-rule states | M | DES-2 |
| DES-5 | Category chip + 6-segment rank ticks | S | DES-2 |
| DES-6 | **Category grid component** — shared between admin setup and public landing | L | DES-5 |
| DES-7 | Court Loader (ball-on-arc, inline + standalone) | S | DES-3 |
| DES-8 | Bottom sheet + modal overlay primitives, safe-area insets | M | DES-3 |
| DES-9 | Form primitives — thumb-zone stepper, combobox, on-blur inline validation | M | DES-1 |
| DES-10 | Print stylesheet — one-ink-on-white mode, page rule survives to paper | M | DES-1 |

DES-4 and DES-6 are the two components that appear on nearly every surface in both apps. Build them properly before anything that consumes them.

---

## Epic: ADM — Admin panel

| ID | Task | Size | Depends on |
|---|---|---|---|
| ADM-1 | Tournament CRUD — name, venue, dates, timezone, visibility | S | DB-2, INF-2 |
| ADM-2 | Courts CRUD | S | ADM-1 |
| ADM-3 | Category ladder editor (org-level, rank ordering) | M | DB-2 |
| ADM-4 | **Category grid setup** — cell toggles, per-cell format + scoring config | L | DES-6, ADM-3 |
| ADM-5 | Bulk row/column format actions | S | ADM-4 |
| ADM-6 | Template save, "same as last time", copy-from-previous-tournament | M | ADM-4 |
| ADM-7 | Entrant list per event — paste parser, CSV import with column mapping, preview before commit | L | ADM-4 |
| ADM-8 | Doubles pairing UI + unpaired-player tray | M | ADM-7 |
| ADM-9 | Manual seeding — drag order, seed divider, unseeded-random toggle | M | ADM-7 |
| ADM-10 | Move entrant between cells, pre- and post-generation | M | ADM-7 |
| ADM-11 | **Draw generation UI** — preview, bye explanation, seeding-mode statement, regenerate | L | ENG-4, ADM-9 |
| ADM-12 | Manual slot override + `manuallyAdjusted` flag | M | ADM-11 |
| ADM-13 | Event status transitions, `notRun`, under-fill advisory flag (never blocks) | M | ADM-4 |
| ADM-14 | Player directory — search, edit, manual merge with reversible audit | L | DB-2 |
| ADM-15 | Withdrawal handling, pre- and post-draw | M | ENG-11, ADM-11 |

ADM-11 must state *in words* which seeding mode produced the draw — "unseeded random draw, 4 byes assigned at random" vs "6 seeds placed, byes to seeds 1–4". Organizer trust in the draw is a product requirement.

---

## Epic: ENT — Entry form, review queue, distribution

| ID | Task | Size | Depends on |
|---|---|---|---|
| ENT-1 | Public entry form page — 4 required fields, grid multi-select, autocomplete attrs | L | DES-9, DES-6 |
| ENT-2 | Submission endpoint — strict schema, length caps, rate limit, honeypot, time-to-submit | M | DB-8 |
| ENT-3 | Turnstile integration, per-tournament toggle | S | ENT-2 |
| ENT-4 | Email uniqueness + returning-player resolution, household-sharing error copy | M | ENT-2, DB-2 |
| ENT-5 | Partner matching by email or name, held until partner registers | M | ENT-4 |
| ENT-6 | Confirmation page + bookmarkable status URL, built to be screenshotted | M | ENT-2 |
| ENT-7 | **Review queue** — dense list, `J/K/A/R/E`, bulk accept, accept-with-edits | L | ENT-4, ADM-14 |
| ENT-8 | Adjacent-name sorting in queue and directory (no flags, no badges) | S | ENT-7 |
| ENT-9 | QR generator — client-side, 4 targets, SVG + PNG export, error correction Q | M | ADM-4 |
| ENT-10 | Printable QR sheet, 1-up and 4-up | M | ENT-9, DES-10 |
| ENT-11 | 🔒 Closed-form and finished-tournament pages — **never a 404** | S | ENT-1 |
| ENT-12 | `?src=` attribution counting, no cookies | S | ENT-9 |

**ENT-2 is the only unauthenticated write endpoint in the product.** A submission can only ever create a `pending` row — never a `Player`, never an `Entrant`, never anything the public site renders. Treat its review accordingly.

**ENT-11** protects printed posters that outlive the thing they point at. Small task, visible failure if skipped.

---

## Epic: PUB — Public site

| ID | Task | Size | Depends on |
|---|---|---|---|
| PUB-1 | Tournament landing — category grid as primary nav, ladder order, live strip | M | DES-6 |
| PUB-2 | Routing + slug resolution, `C+` → `c-plus` slugify | M | DB-4 |
| PUB-3 | **Bracket — full mode**: SVG render, pan/zoom, minimap for ≥32 | XL | ENG-7, DES-4 |
| PUB-4 | **Bracket — round column mode**: mobile snap-scroll, sticky round tabs, progress rail | L | PUB-3 |
| PUB-5 | Bracket — path view (one entrant's route to the final) | M | PUB-3 |
| PUB-6 | Match detail sheet + deep-link focus | M | PUB-3, DES-8 |
| PUB-7 | Standings view + results crosstab, sticky first column on mobile | L | ENG-9, DES-4 |
| PUB-8 | Tiebreaker reasoning disclosure | M | ENG-10, PUB-7 |
| PUB-9 | Player page spanning every event they're in | M | PUB-2 |
| PUB-10 | Entrant search across the whole tournament | S | PUB-9 |
| PUB-11 | In-draw category switcher — sticky chips + bottom-sheet picker | M | DES-6, DES-8 |
| PUB-12 | 🔒 Bracket keyboard navigation + screen-reader semantics | L | PUB-3 |
| PUB-13 | ISR + revalidation on result change | M | PUB-3 |

PUB-3 is the single largest task in the backlog and the product's centrepiece. PUB-12 is a shipping gate, not a follow-up — retrofitting keyboard traversal onto a pan/zoom SVG canvas is substantially harder than building it in.

---

## Epic: SCR — Scoring & live

| ID | Task | Size | Depends on |
|---|---|---|---|
| SCR-1 | **Courtside score entry** — 56px steppers, thumb zone, one set per screen, high-glare contrast | L | DES-9, ENG-14 |
| SCR-2 | Validation wired to format presets so invalid scores are unreachable | M | ENG-14, SCR-1 |
| SCR-3 | Non-standard outcome UI — retire / walkover / default, one tap deep | M | SCR-1 |
| SCR-4 | Idempotent submission (`clientEventId`) + inline error and retry | M | DB-6, SCR-1 |
| SCR-5 | Undo last score action via `ScoreEvent` | M | DB-6 |
| SCR-6 | Winner resolution — fill the parent's `sourceRef` slot | M | DB-5, ENG-4 |
| SCR-7 | `LISTEN/NOTIFY` → SSE stream, category-tagged | L | DB-6 |
| SCR-8 | Live client subscription, reconnect with backoff, honest connection indicator | M | SCR-7 |

---

## Epic: MOT — Motion

The nine named motions. Each has a defined duration and easing in `docs/design-system.md` §5.

| ID | Task | Size | Depends on |
|---|---|---|---|
| MOT-1 | Draw Reveal — round-by-round stagger | M | PUB-3 |
| MOT-2 | Score Tick — single-digit roll, no reflow | S | SCR-8 |
| MOT-3 | **Advance Line** — connector draws, winner crossfades into parent | M | SCR-6, PUB-3 |
| MOT-4 | Live Pulse — breathing optic-yellow rule | S | DES-4 |
| MOT-5 | Bracket pan/zoom springs + inertia (overlaps PUB-3) | L | PUB-3 |
| MOT-6 | Shared element — bracket node → detail sheet | M | PUB-6 |
| MOT-7 | Standings Reorder FLIP | M | PUB-7 |
| MOT-8 | Champion Reveal — 4-phase sequence, no confetti | M | PUB-3 |
| MOT-9 | 🔒 Reduced-motion audit across all nine | M | MOT-1..8 |

MOT-3 is the most satisfying moment in the product and worth disproportionate attention.

---

## Epic: SCH — Scheduling

| ID | Task | Size | Depends on |
|---|---|---|---|
| SCH-1 | Court + time assignment, drag-to-court day view | L | ADM-2, ADM-11 |
| SCH-2 | **Cross-event conflict detection** — entrant overlap, court double-book, rest time | L | SCH-1 |
| SCH-3 | Next-up queue per court for a call-to-court display | M | SCH-1 |

SCH-2 is load-bearing rather than advisory: a player may enter any number of draws, including two categories in the same discipline, and no draw generator knows about the others. The scheduler is the only place that collision is visible, so it must span every event in the tournament.

---

## Epic: OUT — Outputs

| ID | Task | Size | Depends on |
|---|---|---|---|
| OUT-1 | Printable draw sheet PDF, A4/Letter | M | PUB-3, DES-10 |
| OUT-2 | Printable match slips | S | DES-10 |
| OUT-3 | CSV exports — results, entrant contact list | S | DB-5 |
| OUT-4 | OG share cards per event and match, plus square QR card | M | DES-1 |

---

## Epic: QA — Shipping gates

From `docs/design-system.md` §8. These are pass/fail, not aspirations.

| ID | Task | Size | Depends on |
|---|---|---|---|
| QA-1 | Performance harness — CLS < 0.05, LCP < 1.5s on 4G, bracket ≥55fps on mid-range Android | M | PUB-3 |
| QA-2 | Contrast audit, both themes, WCAG 2.2 AA | S | DES-1 |
| QA-3 | Touch-target CI check (≥44px) | S | DES-1 |
| QA-4 | Horizontal-overflow check — body never scrolls sideways | S | PUB-4 |

---

## Rollup

| Milestone | Epics | Rough size |
|---|---|---|
| M0 — Engine + schema | ENG, DB, INF-1/4 | ~5–6 weeks |
| M1 — Admin core + grid | ADM, DES-1..6, INF-2/3 | ~5–7 weeks |
| M1.5 — Entry + review + QR | ENT | ~3–4 weeks |
| M2 — Public bracket + design | PUB-1..7, PUB-12/13 | ~6–8 weeks |
| M3 — Scoring + live | SCR | ~3–4 weeks |
| M4 — Round robin + hybrid | ENG-8..13 (done in M0), PUB-7/8 | folded above |
| M5 — Motion polish | MOT, OUT-4 | ~3–4 weeks |
| M6 — Scheduling | SCH, OUT-1..3 | ~3–4 weeks |

Single developer, sequential. Parallelizes well across engine / design-system / admin once DB-2 lands.

---

## Not in this backlog

Deliberately excluded, with the decision recorded in `PRD.md` §12:

- Entry fees and payments → `docs/entry-fees-deferred.md`
- Consolation draws → `docs/consolation-draws-deferred.md`
- Mixed doubles, player accounts, skill ratings, outbound email, offline support, special handling for minors, multi-tenant signup

## Still undecided

- **Per-cell third-place playoff default.** Affects a default value in ADM-4 only. Pick any default; it's changeable the day before a tournament.
