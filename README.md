# OpenTennis

A tennis tournament management web app. Admin panel for organizers, public bracket for everyone else.

A tournament is a grid of **skill categories × disciplines** — `Open, A, B, C+, C, D` across singles and doubles — and each cell of that grid is a draw with its own format. Stronger categories typically run as round robins because few people enter; lower categories fill up and run as brackets. All of it is admin-configurable per cell.

**Formats:** single elimination · round robin · hybrid (groups → playoff).

**The product has no concept of player skill.** No ratings, no NTRP/UTR. Players self-select their category; seeding is manual or absent.

**Only admins have accounts.** Entrants are records, not users — nobody but an administrator ever logs in. Players enter via an optional public form (a form is not an account: no password, no session) which creates a pending entry an admin approves. Scorekeepers get revocable link tokens.

**Email is the identity key**, unique per organization, which is what replaces fuzzy name matching. Name, email, and phone are all required at registration. Nothing is ever blocked on a name being similar to another — admins notice duplicates themselves.

**Nothing is ever emailed.** No confirmations, no reminders, no announcements. Addresses are an identity key and an organizer's contact list. Distribution runs on **QR codes** (generated per tournament and per event) and social links instead, which makes QR generation core infrastructure rather than a convenience.

**No payments, ever.** No card data touches the system, which keeps it entirely out of PCI scope. Entry-fee tracking is parked in `docs/entry-fees-deferred.md` and not in v1.

## Status

Specification phase. No code yet.

## Documents

| Document | What's in it |
|---|---|
| [`BACKLOG.md`](BACKLOG.md) | **Start here to build.** ~100 tasks across 10 epics, with sizes, dependencies, a critical path, and guardrails marked 🔒 |
| [`PRD.md`](PRD.md) | Product requirements — personas, domain model, admin and public feature specs, architecture, milestones, open questions |
| [`docs/tournament-formats.md`](docs/tournament-formats.md) | Engine specification — seeding algorithms, bye assignment, circle-method scheduling, tiebreaker cascades, scoring formats, test strategy |
| [`docs/design-system.md`](docs/design-system.md) | Art direction, color and type tokens, the nine named motions, mobile specification, banned patterns, quality gates |
| [`docs/entry-fees-deferred.md`](docs/entry-fees-deferred.md) | 🅿️ **Parked, not in v1.** Fee ledger design, kept so it can be picked up without re-deriving it. Skip this when implementing. |
| [`docs/consolation-draws-deferred.md`](docs/consolation-draws-deferred.md) | 🅿️ **Parked, not in v1.** Consolation/backdraw design. Worth one read before building the bracket renderer — §4 lists three free guardrails that keep it cheap to add later. |

## Reading order

Start with `PRD.md` §4 (domain model). The decision everything else follows from is that **`Event` is the join of a category and a discipline** — "C+ Doubles" is a row in a table, not a name someone typed. That's what makes the setup grid, the public category switcher, and reusable season templates possible.

Then pick by role:
- **Engineering** → `docs/tournament-formats.md`. The draw engine is a pure, framework-free package; that document is its contract.
- **Design** → `docs/design-system.md`. §1 is the premise, §7 is the list of things not to do.

## Next steps

Scope is settled — one open question remains (§12), and it's a default value that can be changed the day before a tournament. Build order:

1. Scaffold the `@opentennis/engine` workspace package and write the test suite from `docs/tournament-formats.md` §6 **before** the implementation. Start with the fully-unseeded and small-field cases (`N` = 2–5) — those are the realistic Open and A draws, not the edge cases.
2. Schema, with the §9.1 multi-tenancy disciplines in place from the first migration: `organizationId` on every table, the filter enforced at the data-access layer, and **globally unique tournament slugs** (that last one protects every printed QR code from a future URL change).
3. Build the token layer, then the **match node** and the **category grid** — the two components that appear on nearly every surface in both the admin and public apps.
4. Read `docs/consolation-draws-deferred.md` §4 before writing the bracket renderer. Three guardrails there cost nothing now and are expensive to retrofit — chiefly: **the renderer takes a stage, not an event.**
