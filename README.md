# OpenTennis

Tournament management for Open Tennis, a club in Tijuana, Mexico. Admin panel
for organizers, public bracket for everyone else.

A tournament is a grid of **skill categories × disciplines** — `Open, A, B, C+,
C, D` across singles and doubles — and each cell of that grid is a draw with its
own format. Stronger categories typically run as round robins because few
people enter; lower categories fill up and run as brackets. All of it is
admin-configurable per cell.

**Formats:** single elimination · round robin · hybrid (groups → playoff), each
with an optional consolation draw as a second stage.

**The product has no concept of player skill.** No ratings, no NTRP/UTR.
Players self-select their category; seeding is manual or absent.

**Only admins have accounts.** Entrants are records, not users — nobody but an
administrator ever logs in. Players enter via an optional public form (a form is
not an account: no password, no session) which creates a pending entry an admin
approves. Scorekeepers get revocable link tokens. Signed-in accounts carry a
role — `owner` / `admin` / `scorekeeper` / `viewer` — checked as capabilities,
so a scorekeeper cannot delete a draw.

**Email is the identity key**, unique per organization, which is what replaces
fuzzy name matching. Name, email, and phone are all required at registration.
Nothing is ever blocked on a name being similar to another — admins notice
duplicates themselves.

**Email is sent only for one-time admin invitations.** No confirmations,
reminders, announcements, scorekeeper links, entry messages, or results are
emailed. Addresses are an identity key and an organizer's contact list.
Distribution runs on **QR codes** (generated per tournament and per event) and
social links instead, which makes QR generation core infrastructure rather than
a convenience.

**Entry fees are optional and off by default.** Checkout is Stripe-hosted —
card, plus OXXO cash vouchers and SPEI transfer on MXN — so no card number
reaches this server (PCI SAQ-A). With `STRIPE_SECRET_KEY` unset the pay buttons
disappear and an organizer ticks entries paid by hand, which is how the club has
run so far.

**`es-MX` is the default locale.** A first visit with no cookie, and every QR
code scanned off a poster, lands in Spanish. English is the translation.

## Status

**Live at [www.opentennis.mx](https://www.opentennis.mx).** A tournament can be
run end to end: draws generate, entrants register themselves through a QR code
that records which poster they scanned, seeds and payments are managed, the
scheduler allots courts, results go in courtside, and the winner advances on the
public bracket.

867 tests — 413 engine · 86 db · 368 web. The engine is at 100%
statements/lines/functions. Build, typecheck, lint and the design audit are
clean; no horizontal overflow at 390px on any route.

**No real tournament has been run on it yet.** The `production` database
carries the organization, the admin user and the six-category ladder, and
nothing else. What stands between here and a real event is in
[`BACKLOG.md`](BACKLOG.md) — review of the branch in flight, creating the
tournament in production, the doubles pairing flow, and snapshot discipline for
the day.

## Layout

pnpm monorepo. `apps/web` (Next.js 15 App Router) · `packages/engine` (pure
draw logic, no I/O) · `packages/db` (Neon Postgres + Drizzle).

```sh
pnpm -r test                  # 867 tests
pnpm -r typecheck
pnpm lint
node .claude/skills/design-review/audit.mjs
cd apps/web && pnpm build     # never while a dev server is up — see CLAUDE.md
```

## Documents

| Document | What's in it |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Start here to work on it.** Commands, the two database branches, deploy shape, design rules, data recovery, and the list of things that have already bitten someone |
| [`BACKLOG.md`](BACKLOG.md) | What's left before a real tournament |
| [`PRD.md`](PRD.md) | Product requirements — personas, domain model, admin and public specs, architecture |
| [`docs/tournament-formats.md`](docs/tournament-formats.md) | Engine specification — seeding, byes, circle-method scheduling, tiebreaker cascades, scoring formats |
| [`docs/design-system.md`](docs/design-system.md) | Art direction, tokens, the nine named motions, mobile spec, banned patterns, quality gates |
| [`docs/specs/opentennis-admin-invite.md`](docs/specs/opentennis-admin-invite.md) | One-time admin invitation flow, exact copy, and database contract |
| [`docs/specs/opentennis-qa-backlog.md`](docs/specs/opentennis-qa-backlog.md) | The OT-* ticket source. Batch 4 is unstarted |
| [`docs/archive/`](docs/archive/README.md) | Superseded docs, kept for the reasoning. Nothing in there is current |

## Reading order

Start with `PRD.md` §4 (domain model). The decision everything else follows
from is that **`Event` is the join of a category and a discipline** — "C+
Doubles" is a row in a table, not a name someone typed. That's what makes the
setup grid, the public category switcher, and reusable season templates
possible.

Then pick by role:

- **Engineering** → `CLAUDE.md` first, then `docs/tournament-formats.md` for
  the engine contract.
- **Design** → `docs/design-system.md`. §1 is the premise, §7 is the list of
  things not to do. Run the audit before shipping UI.
