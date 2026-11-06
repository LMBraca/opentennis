# OpenTennis — Backlog

**Last audited:** 2026-11-05, by checking each task against the code rather
than against the previous version of this file. The version before this one
claimed 410 tests and "next up: DES-1"; both had been true weeks earlier.

**510 tests** — 396 engine · 56 db · 58 web. Engine at 100%
statements/lines/functions. Build, lint and the design audit are clean; no
horizontal overflow at 390px on any route.

---

## Where this actually stands

A tournament can now be run end to end: draws generate, entrants register
themselves through a QR code that records which poster they scanned, seeds
and payments are managed, the scheduler allots courts, results go in
courtside, and the winner advances on the public bracket.

It is **live at https://www.opentennis.mx**, so the club can reach it from
a phone at the court.

What is missing now is the edges: no review queue before entries appear, no
player directory, no printable draw sheet, and no live score push.

| Epic | Status |
|---|---|
| ENG — draw engine | ✅ complete (16/16) |
| DB — schema | ✅ complete (9/9) |
| DES — design system | ✅ 10/10 |
| SCH — scheduling | ✅ complete |
| ADM — admin panel | 🟡 11/15 |
| ENT — entry & distribution | ✅ complete (12/12) |
| PUB — public site | 🟡 8/13 |
| INF — platform | ✅ complete (4/4) |
| **SCR — scoring** | ✅ complete (8/8) |
| OUT — outputs | 🟡 2/4 — draw sheet, order of play |

---

## Next three

1. **ADM-8** — doubles pairing UI. Partner is a free-text field, so two
   halves of a pair can spell each other differently and nothing reconciles
   them. **Waiting on the club to say what the flow should be.**
2. **PUB-6** — match detail sheet. The bracket shows a score; nothing shows
   a match — who, when, which court, the sets.
3. **OUT-3** — results export, so a season's results leave the product.




---

## Epic: SCR — Scoring & live · 8/8 ✅

Score entry lives at `/admin/:slug/scores` — a list, not a bracket, because
an organizer works through an order of play. The rules live in a pure
module (`lib/match-result.ts`) so they are testable without a database.

✅ SCR-1 entry UI · SCR-2 validation delegated to the engine's format rules ·
SCR-3 retire/walkover/default · SCR-4 idempotency via `clientEventId` ·
SCR-6 winner propagation through `matchSides.sourceKind`, handling
`loserOf` as well as `winnerOf` · SCR-7 live stream · SCR-8 spectator
subscription

| ID | Missing | Notes |
|---|---|---|
| ~~SCR-5~~ | ✅ **Per-event undo** | Steps a match back one event instead of emptying it. Marks `revertedByEventId`, the column unused since DB-6 |
| ~~SCR-7~~ | ✅ **Live stream** | `GET /api/live/:slug`, server-sent events. One poller per tournament per warm instance, shared by every spectator on it |
| ~~SCR-8~~ | ✅ **Spectator subscription** | `components/live-updates.tsx`. Refreshes via `router.refresh()`, so the bracket keeps one renderer |

**DEVIATION, decided deliberately: polling, not `LISTEN/NOTIFY`.** LISTEN
needs a session-mode connection, so it cannot use the pooled `DATABASE_URL`
at all — PgBouncer's transaction mode drops the session state it relies on,
the same trap that bites migrations. That would put a second, direct
connection pattern into production, held open per instance, to serve a club
where a few dozen spectators see a handful of score changes an hour. The
stream instead polls a 2-second fingerprint and pushes only on change; the
client cannot tell the difference.

**The fingerprint comes from `score_events`, NOT `matches.updated_at`.**
`updatedAt` in this schema is `defaultNow()` with no `$onUpdate` and no
trigger, so it is written once at insert and never changes. A version keyed
on it would connect, heartbeat and look perfectly healthy while never firing
once. `score_events` is append-only and every scoring path writes exactly one
row, including `clearResult`.

**Honest connection state** means the strip never claims to be live when it
is not: it renders nothing before the first connection, says "not updating"
when the stream has given up, and drops the stream entirely on a hidden tab
rather than holding a serverless invocation open for nobody.

---

## Epic: INF — Platform · 4/4 ✅

| ID | Task | Status |
|---|---|---|
| INF-1 | Monorepo, Next 15, TS strict | ✅ |
| INF-2 | Auth | ✅ **deviation:** hand-rolled scrypt + server sessions, not Better Auth. Role enum exists but is not enforced — every signed-in user is an admin |
| ~~INF-3~~ | ✅ **Scorekeeper links** | `/admin/:slug/scorekeepers` issues one, `/score/:token` is what the volunteer opens. SHA-256 hashed, shown once, revocable, scoped to one tournament. Logs with `actorUserId` null and the link label, as DB-6 intended |
| ~~INF-4~~ | ✅ **Vercel deploy** | https://www.opentennis.mx — scope `lmbracas-projects`, Root Directory `apps/web`, env set for production and preview |

---

## Epic: ADM — Admin panel · 11/15

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
| ~~ADM-14~~ | ✅ **Player directory + merge** | `/admin/players`. Search folds accents; look-alikes need a matching name AND no contradicting email. Merge is reversible from the log — `playerMerges` stores a snapshot and the exact links moved |

---

## Epic: ENT — Entry & distribution · 12/12 ✅

✅ ENT-1 entry form · ENT-2 hardened endpoint (honeypot, rate limiter, length
caps, 2s human floor) · ENT-4 email uniqueness · ENT-5 partner field ·
ENT-6 confirmation · ENT-7 entry queue · ENT-8 adjacent-name sorting ·
ENT-9 QR codes · ENT-10 print sheet · ENT-11
closed-form page · ENT-12 `?src=` attribution, recorded on the entrant and
shown in the entrants list

| ID | Missing | Notes |
|---|---|---|
| ~~ENT-3~~ | ✅ **Turnstile** | `lib/turnstile.ts`. Fails OPEN when unconfigured or when Cloudflare is unreachable — a spam gate that takes the entry form down with it is worse than the spam. Needs `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` to actually challenge |
| ~~ENT-7~~ | ✅ **Entry queue** | `/admin/:slug/entries`. Review is a **per-tournament toggle, default OFF** — the club asked for entries to appear immediately. Every entry is recorded as a submission either way |
| ~~ENT-8~~ | ✅ Adjacent-name sorting | sorted by accent-folded surname, duplicates land next to each other with a hairline — no badges |
| ~~ENT-9~~ | ✅ **QR generator** | `/admin/:slug/qr`. Five codes, error correction Q, server-rendered SVG |
| ~~ENT-10~~ | ✅ Printable QR sheet | 2-up at A4; `@media print` in globals drops the masthead product-wide |

---

## Epic: PUB — Public site · 8/13

✅ PUB-2 routing and slugs · PUB-3 bracket (SVG, horizontal scroll) · PUB-4
mobile round columns · PUB-7 standings + crosstab · PUB-11 draw switcher ·
PUB-12 bracket keyboard navigation · PUB-13 revalidation · plus updates and
media, which were never in this backlog

| ID | Missing | Notes |
|---|---|---|
| PUB-1 | ~~Tournament landing~~ | **removed by request.** `/t/:slug` redirects to the first draw; the route stays alive because QR codes point at it |
| PUB-3b | Pan/zoom + minimap for ≥32 draws | the bracket scrolls; it does not zoom |
| PUB-5 | Path view | |
| PUB-6 | Match detail sheet | |
| PUB-9 | Player page across events | |
| PUB-10 | Entrant search | |
| ~~PUB-12~~ | ✅ 🔒 Bracket keyboard navigation | one tab stop, arrows by round and slot, focus lands on the aria-labelled node |

---

## Epic: DES · 10/10 — DES-10 landed with the QR sheet (`@media print` in globals.css)

## Epic: OUT — Outputs · 2/4

| # | Item | Notes |
|---|---|---|
| ~~OUT-1~~ | ✅ **Printable draw sheet** | `/admin/:slug/print`. One page per draw, landscape, scaled SVG. Round-robin draws print as a crosstab box instead of a bracket |
| ~~OUT-2~~ | ✅ **Order of play** | `/admin/:slug/order`. By day, then time, then court. Byes excluded from the "not scheduled" count — nobody turns up for one |
| OUT-3 | Results export | |
| OUT-4 | Shareable image | `layoutBracket` geometry already drives two renderers; a third could emit a share card |

**OUT-1 notes.** The sheet is its own renderer, not the public draw page with
print CSS: the interactive bracket is `display: none` below 1024px and A4
portrait is ~794 CSS px, so printing that page yields the phone snap-scroller
cropped to its first round. Slots sit on ruled lines with the right-hand end
left clear so scores can be written in pen, and undecided later rounds print
blank rather than "Winner of QF2". Uses `loadDrawForAdmin` — the public query
hides drafts, and the sheet is wanted most before a tournament is published.

---

## Not in the original backlog, built anyway

**Scoring format is settable.** The six columns on `events` and the engine's
seven presets had existed since DB-2 and nothing ever wrote them, so every
draw silently played best-of-3-to-6 whatever the club agreed. There is now a
scoring panel on each draw's admin page, plus `rounds.scoring_override`
(migration 0008) for "the final is best of 3, the rest are pro sets".
Resolution is round → event through `resolveScoringFormat`.

**Draw generation is guarded.** It refuses while registration is open, and
never overwrites an existing draw; replacing one is a typed confirmation that
refuses outright once a match has a result.

**Spanish is the default locale**, and the tab icon is the ball mark rather
than the full badge, which was unreadable at 16px.

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
