# OpenTennis — Backlog

**Last audited:** 2026-11-05, by checking each task against the code rather
than against the previous version of this file. The version before this one
claimed 410 tests and "next up: DES-1"; both had been true weeks earlier.

**487 tests** — 396 engine · 56 db · 35 web. Engine at 100%
statements/lines/functions. Build, lint and the design audit are clean; no
horizontal overflow at 390px on any route.

---

## Where this actually stands

The product can run a tournament right up to the moment somebody wins a
match, and then stops. Draws generate, entrants register themselves, seeds
and payments are managed, the scheduler allots courts — and every match on
every bracket shows `–`, because **there is no way to enter a result**.

That is the whole of the gap. It is one epic.

| Epic | Status |
|---|---|
| ENG — draw engine | ✅ complete (16/16) |
| DB — schema | ✅ complete (9/9) |
| DES — design system | ✅ 10/10 |
| SCH — scheduling | ✅ complete |
| ADM — admin panel | 🟡 10/15 |
| ENT — entry & distribution | 🟡 10/12 |
| PUB — public site | 🟡 7/13 |
| INF — platform | 🟡 2/4 |
| **SCR — scoring** | 🟡 5/8 — entry, validation, outcomes, idempotency, propagation |
| OUT — outputs | ❌ 0/4 |

---

## Next three

1. **SCR-1 → SCR-6** — score entry and winner propagation. Without these the
   product is a draw viewer, not a tournament tool.
2. **INF-4** — deploy. It currently runs on one laptop.
3. **ENT-7** — the review queue, so entries can be checked before they
   appear. `entrySubmissions` is still unused.

---

## Epic: SCR — Scoring & live · 0/8 · THE GAP

Foundations are all in place and unused: `matches`, `matchSides`, `sets`,
`scoreEvents`, `standings` tables; engine `summariseMatch`, `setWinner`,
`isCompletedSet`, `isValidTiebreak`, seven scoring presets; and the per-event
format stored flat on `events` (setsToWin, gamesPerSet, tiebreakAt,
tiebreakTo, decidingSetMode, adScoring) which maps 1:1 onto the engine's
`ScoringFormat`. Nothing writes to any of it.

| ID | Task | Size | Notes |
|---|---|---|---|
| SCR-1 | Courtside score entry — thumb zone, one match per screen | L | |
| SCR-2 | Validation wired to the event's own format | M | engine does the deciding |
| SCR-3 | Retire / walkover / default, one tap deep | M | `matchOutcome` enum exists |
| SCR-4 | Idempotent submission via `clientEventId` | M | column exists, unused |
| SCR-5 | Undo via the `ScoreEvent` log | M | append-only, `revertedByEventId` exists |
| SCR-6 | **Winner resolution** — fill the parent's `sourceRef` slot | M | without this a result changes nothing downstream |
| SCR-7 | `LISTEN/NOTIFY` → SSE | L | |
| SCR-8 | Live client subscription with honest connection state | M | |

SCR-6 is the one that is easy to underestimate. `matchSides` carries
`sourceKind` / `sourceMatchId` / `sourceRank`; a completed match has to walk
forward and fill the slot it feeds, or the bracket never advances.

---

## Epic: INF — Platform · 2/4

| ID | Task | Status |
|---|---|---|
| INF-1 | Monorepo, Next 15, TS strict | ✅ |
| INF-2 | Auth | ✅ **deviation:** hand-rolled scrypt + server sessions, not Better Auth. Role enum exists but is not enforced — every signed-in user is an admin |
| INF-3 | Scorekeeper link tokens | ❌ `scorekeeperTokens` table exists, zero application code |
| INF-4 | **Vercel deploy** | ❌ `vercel.json` is written, `.vercel/` does not exist. Never deployed |

---

## Epic: ADM — Admin panel · 10/15

✅ ADM-1 tournament CRUD · ADM-2 courts (via the schedule page) · ADM-4 category
grid setup · ADM-5 bulk actions · ADM-6 templates · ADM-7 entrant list + paste
parser · ADM-9 seeding · ADM-11 draw generation with the seeding statement in
words · ADM-13 event status · ADM-15 withdrawal

| ID | Missing | Notes |
|---|---|---|
| ADM-3 | Category ladder editor | ladder is seeded; no UI to reorder or add |
| ADM-7b | CSV import with column mapping | paste parser only |
| ADM-8 | Doubles pairing UI + unpaired tray | partner name is a free-text field |
| ADM-12 | Manual slot override + `manuallyAdjusted` flag | |
| ADM-14 | Player directory, search, reversible merge | `playerMerges` table exists, unused |

---

## Epic: ENT — Entry & distribution · 10/12

✅ ENT-1 entry form · ENT-2 hardened endpoint (honeypot, rate limiter, length
caps, 2s human floor) · ENT-4 email uniqueness · ENT-5 partner field ·
ENT-6 confirmation · ENT-9 QR codes · ENT-10 print sheet · ENT-11
closed-form page · ENT-12 `?src=` attribution, recorded on the entrant and
shown in the entrants list

| ID | Missing | Notes |
|---|---|---|
| ENT-3 | Turnstile | |
| ENT-7 | **Review queue** | entries land `active` immediately. The PRD's pending→accept flow does not exist, and `entrySubmissions` is unused |
| ENT-8 | Adjacent-name sorting | depends on ENT-7 |
| ~~ENT-9~~ | ✅ **QR generator** | `/admin/:slug/qr`. Five codes, error correction Q, server-rendered SVG |
| ~~ENT-10~~ | ✅ Printable QR sheet | 2-up at A4; `@media print` in globals drops the masthead product-wide |

---

## Epic: PUB — Public site · 7/13

✅ PUB-2 routing and slugs · PUB-3 bracket (SVG, horizontal scroll) · PUB-4
mobile round columns · PUB-7 standings + crosstab · PUB-11 draw switcher ·
PUB-13 revalidation · plus updates and media, which were never in this
backlog

| ID | Missing | Notes |
|---|---|---|
| PUB-1 | ~~Tournament landing~~ | **removed by request.** `/t/:slug` redirects to the first draw; the route stays alive because QR codes point at it |
| PUB-3b | Pan/zoom + minimap for ≥32 draws | the bracket scrolls; it does not zoom |
| PUB-5 | Path view | |
| PUB-6 | Match detail sheet | |
| PUB-9 | Player page across events | |
| PUB-10 | Entrant search | |
| PUB-12 | 🔒 Bracket keyboard navigation | marked a shipping gate and not met |

---

## Epic: DES · 10/10 — DES-10 landed with the QR sheet (`@media print` in globals.css)

## Epic: OUT — Outputs · 0/4

Printable draw sheet, order of play, results export, shareable image. All
depend on DES-10.

---

## Not in the original backlog, built anyway

i18n (EN/ES, Mexican Spanish) · branding and sponsor lockup · updates and
media CMS with an admin editor and a hand-rolled Markdown renderer ·
`PageHeader`/`PageBody` as the single page shell · the `design-review` skill
and its audit script · Stripe scaffolding (needs real keys) · the WebGL hero

---

## Still undecided

- Third-place playoff default per cell.
- Consolation draws — deliberately deferred, see
  `docs/consolation-draws-deferred.md`.
- Whether `--paper-50` (#f6f6f1) should move away from the "AI cream" the
  `frontend-design` skill warns about.
- Whether `Reveal`'s per-row fade-up should go; the same skill calls
  scattered section entrances a generated-page tell.
