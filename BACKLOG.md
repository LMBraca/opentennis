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
