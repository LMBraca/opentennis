# Archive

Documents that no longer describe this product. Kept because they record why
decisions were made, not because anything should be read out of them.

**Nothing in this folder is current. Do not implement from it.** If something
here contradicts `/CLAUDE.md`, `/README.md`, or `/BACKLOG.md`, those win.

| Document | Why it is here |
|---|---|
| `BACKLOG.md` | The feature backlog, through the 2026-11-05 audit. Every epic in it is complete. Two of its claims were already false when it was archived: it reported 510 tests (actual: 798) and said INF-2's role enum was unenforced, when `packages/db/src/roles.ts` had shipped four roles against nine capabilities. Replaced by the production-readiness backlog at `/BACKLOG.md`. |
| `consolation-draws-deferred.md` | Described consolation draws as parked for a later version. They were built. A draw now has two stages with `parentStageId`, the engine prefixes consolation round names, and the bracket renderer takes a stage. The three "free guardrails" in its §4 are all in the code — see the consolation entries in `/CLAUDE.md` → Things that bite. |
| `entry-fees-deferred.md` | Described a fee ledger as parked and out of v1. Also built: `lib/stripe.ts`, the fee panel on the admin draw page, `enter/pay-actions.ts`, and a signature-verified webhook at `/api/webhooks/stripe` with replay protection. Card, OXXO and SPEI. Payments degrade to the manual tick when `STRIPE_SECRET_KEY` is unset, which is why the product ran for weeks looking like it had no payments at all. |
| `grok/` | Handoff written for a Grok Bot usage-limit contingency, plus its zip. Accurate as a record of batches 1–3; stale on branch state (it says `batch3-organizer-truthfulness` is unpushed — it is pushed, and `origin` matches local). Untracked by git (`.gitignore` ignores `grok/` at any depth). |

## Still current, elsewhere

Not everything old is archived. These are deliberately kept in place:

- `/PRD.md` — the product spec of record. §4 (domain model) and §4.4 (slug
  permanence) are still cited by `/CLAUDE.md`.
- `/docs/tournament-formats.md` — the engine's contract. The engine is
  complete and at 100% statement coverage; this is what it is complete
  *against*.
- `/docs/design-system.md` — enforced on every UI change by
  `.claude/skills/design-review/audit.mjs`.
- `/docs/specs/opentennis-qa-backlog.md` — the OT-* ticket source. Batch 4
  (OT-26–OT-37) is unstarted, so this is live.
- `/docs/design/opentennis-qa-ux.md` — the es-MX copy and UX notes batch 3
  is graded against. Retire it once batch 3 merges.
