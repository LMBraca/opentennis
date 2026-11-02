# Consolation Draws — Deferred Design

**Status:** 🅿️ **Parked. Not in v1.** Kept in the bag.
**Last updated:** 2026-11-01
**Parent:** [`../PRD.md`](../PRD.md) §12

Nothing here is built. This document exists so the feature can be picked up without re-deriving the design, and so that v1 doesn't accidentally foreclose it.

---

## 1. Correction to an earlier claim

Previous drafts of the PRD said consolation draws "change the bracket data model" and therefore needed deciding early. **That overstated it.** The primitive consolation needs — a bracket slot fed by the *loser* of another match — is already in the v1 spec as `SourceRef`:

```ts
type SourceRef =
  | { kind: 'winnerOf'; matchId: string }
  | { kind: 'loserOf';  matchId: string }   // ← already here, for the third-place playoff
  | { kind: 'groupRank'; groupId: string; rank: number }
  | { kind: 'bye' };
```

So consolation is genuinely deferrable at low risk. What it actually needs is new *structure* (a second linked bracket), new *rendering* (two brackets in one view), and a feed-in rule — not a rewrite of how matches reference their sources.

**The one thing v1 must not do** is assume an `Event` has exactly one knockout `Stage`, or that a `Stage` has no parent. §4 below lists the specific guardrails.

---

## 2. Why clubs want this

In a 48-entrant D draw, half the field loses on Saturday morning and drives home. They paid the same entry and got one match. "Everyone gets at least two matches" is a common promise at club level and consolation is how it's kept.

Relevance scales with draw size, so this matters most for exactly the categories that use single elimination — C+, C, D — and not at all for the round robin categories, where everyone already plays everyone.

---

## 3. Format options

### 3a. First-round-loser consolation — **recommended**

Every entrant who loses in round 1 of the main draw enters a separate single-elimination consolation bracket.

- Consolation field size is **exactly `(N − B) / 2`**, where `N` = entrants and `B` = byes. Known at main-draw generation time.
- Fully pre-renderable: the consolation bracket's complete structure exists the moment the main draw is generated, with every slot carrying `{ kind: 'loserOf', matchId }`. This preserves the v1 principle that a bracket is a complete, animatable object before any ball is hit.
- Cost: a player who received a bye and then lost their first match played (in round 2) gets **no** consolation match. Slightly less generous than the alternative, and worth saying out loud in the UI.

### 3b. First-*match*-loser consolation

Anyone who loses their first match played enters consolation, including bye recipients who lose in round 2.

- More generous and arguably fairer — it's the USTA's framing for a reason.
- **But the field size is not deterministic.** It's `(N − B) / 2` plus however many bye recipients lose their round-2 match, which isn't known until those matches are played. The consolation bracket cannot be fully pre-generated.
- Would require either progressive generation (structure materializes as feeders resolve, breaking the pre-render principle) or a bracket sized to the maximum with slots that collapse when a bye recipient wins.
- Viable, but it costs the cleanest architectural property in the product. Only take it if organizers specifically ask.

### 3c. Feed-in consolation (FIC)

Losers from multiple rounds feed into the consolation bracket at staggered entry points — "FIC to the quarterfinals", "FIC to the semifinals", full FIC.

- Deterministic and pre-renderable, like 3a.
- Meaningfully more complex: needs a mapping table of which round's losers enter the consolation bracket at which round, and the arithmetic differs per main-draw size.
- Produces a lot of matches. Needs court capacity that most clubs running a 6×2 grid won't have on a weekend.

### 3d. Compass draw

East / West / North / South / Northeast / Southwest — losers keep dropping sideways so everyone plays until the event ends. Common in junior events.

- Maximum matches, maximum scheduling load, maximum complexity.
- Realistically a separate feature from "consolation", and probably never worth building for this product.

**Recommendation if this is ever scoped: 3a only.** It delivers the "two matches minimum" promise, is deterministic, and preserves pre-rendering. Treat 3c as a later addition and 3b/3d as unlikely.

---

## 4. Guardrails for v1

Three things to get right now so this stays cheap later. None of them cost anything today.

1. **`Event` must support multiple stages, ordered.** Already true — the hybrid format (round robin groups → playoff) needs it. Don't collapse `Stage` into `Event` as a shortcut just because v1's single-elimination events only have one.
2. **`Stage` needs `parentStageId` to be addable without restructuring.** Keep `Stage` as a real table with its own identity, not an enum column on `Event`.
3. **The bracket renderer should take a stage, not an event.** If the public bracket view is written as "render the event's matches", adding a second linked bracket means rewriting it. If it's written as "render this stage", the consolation bracket is a second invocation plus a tab.

Guardrail 3 is the one most likely to be violated by accident, and the most expensive to undo.

---

## 5. Model additions, when built

```ts
interface Stage {
  // ... existing v1 fields
  kind: 'roundRobin' | 'singleElimination' | 'consolation';
  parentStageId: string | null;      // consolation points at the main draw
  feedRule: FeedRule | null;
}

type FeedRule =
  | { kind: 'firstRoundLosers' }                       // 3a
  | { kind: 'firstMatchLosers' }                       // 3b — non-deterministic
  | { kind: 'feedIn'; throughRound: number };          // 3c
```

Generation order: main draw first, then the consolation stage derived from it. The consolation generator is a pure function of the main draw's structure — not of its results — which is what keeps 3a pre-renderable.

---

## 6. UI surface, when built

- **Public bracket**: a tab or segmented control inside the draw view — `Main · Consolation`. Not a separate URL path at the category level; it's the same event. Something like `/t/:slug/c/singles?draw=consolation`.
- A player's **path view** should cross the boundary: if Priya loses in round 1, her path continues into the consolation bracket rather than ending. This is the single best argument for the feature and should be designed for deliberately.
- **Admin**: a per-cell toggle in the category grid, alongside the third-place-playoff setting. Off by default.
- The consolation champion is a real result and gets its own Champion Reveal, scaled down — the main draw's champion should still read as the bigger event.
- **Naming matters.** "Consolation" is accurate but reads as a booby prize. Clubs often use "Backdraw" or "Flight B". Make the label configurable per tournament.

---

## 7. Scheduling consequence

Consolation roughly **doubles the match count** for an elimination event. A 48-entrant D Singles draw goes from 47 matches to around 70. On a 10-court club running six other draws the same weekend, that's the binding constraint — not the software.

If this is built, it should ship alongside court-capacity warnings in the scheduler (§5.5), or organizers will enable it and discover the problem on the Saturday.
