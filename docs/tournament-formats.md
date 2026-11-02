# OpenTennis — Tournament Format Specification

**Status:** Draft v0.1
**Last updated:** 2026-11-01
**Parent:** [`../PRD.md`](../PRD.md)

This document specifies the behavior of `@opentennis/engine`. Everything here is pure logic: given entrants and a config, produce a tournament structure and compute standings. No database, no framework, no I/O.

Correctness here is the product's credibility. An organizer who finds one wrong bye placement stops trusting the whole tool.

---

## 1. Core abstractions

```ts
type EntrantId = string;

interface Entrant {
  id: EntrantId;
  seed: number | null;        // 1-indexed; null = unseeded. ADMIN-ASSIGNED ONLY.
  status: 'active' | 'withdrawn' | 'noShow';
  clubId?: string;            // only for the optional same-club avoidance constraint
  // engine is deliberately blind to how many players are inside,
  // and to which skill category this draw belongs to
}

interface MatchSide {
  position: 0 | 1;
  entrantId: EntrantId | null;
  sourceRef: SourceRef | null;  // where this side comes from if undecided
}

type SourceRef =
  | { kind: 'winnerOf'; matchId: string }
  | { kind: 'loserOf';  matchId: string }   // third-place playoff
  | { kind: 'groupRank'; groupId: string; rank: number }
  | { kind: 'bye' };
```

**Design rule:** the engine never mutates a published structure. Advancing a winner is a *resolution* step that fills `entrantId` on a side whose `sourceRef` already pointed at the completed match. The shape of the tournament is fixed at generation time.

**Determinism rule:** every generation function takes an explicit `randomSeed: string`. Any shuffling uses a seeded PRNG (xorshift128 is fine). The seed is persisted so a draw is reproducible and auditable.

**No-skill rule:** there is no rating anywhere in the engine. Seeds are integers an admin typed or dragged into place, and they are frequently all `null`. Every generation path must work correctly with a fully unseeded field — that is the common case, not the edge case.

**Category rule:** skill category (`Open`, `A`, `B`, `C+`, `C`, `D`) is **not an engine concept.** The application layer decides which entrants belong to which draw and calls the engine once per draw. A 6-entrant Open round robin and a 48-entrant D bracket are two independent, identical invocations. The engine never sees a category string, never branches on one, and must never gain the ability to — the moment category leaks into the engine, "A is round robin" stops being an admin-editable default and becomes hardcoded behavior.

---

## 2. Single elimination

### 2.1 Bracket sizing

```
bracketSize = 2 ** ceil(log2(N))      // N = active entrants, min 2
byeCount    = bracketSize - N
rounds      = log2(bracketSize)
```

Supported `N`: 2–128. Above 128, reject with a clear error rather than degrade.

### 2.2 Seed placement

Standard mirrored (snake) placement. Position *i* in the bracket receives seed `seedOrder[i]`:

```ts
function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const mirror = order.length * 2 + 1;
    const next: number[] = [];
    for (const s of order) next.push(s, mirror - s);
    order = next;
  }
  return order;
}
```

Each pass doubles the bracket and mirrors every existing seed against the new total plus one, so a slot holding seed `s` gains a partner holding `(2 × currentLength + 1) − s`. From `[1, 2]`: mirror is 5, giving `[1, 4, 2, 3]`; then mirror is 9, giving `[1, 8, 4, 5, 2, 7, 3, 6]`.

> An earlier revision of this document had `order.length * 4 + 1` here, which yields 9 instead of 5 on the first pass and produces a wrong draw for every size. Caught by `seedOrder` returning something other than `[1, 4, 2, 3]` for size 4. The literal expected arrays below are worth keeping as a tripwire for exactly this reason.

Verified outputs:

| Size | Order |
|---|---|
| 4 | `1, 4, 2, 3` |
| 8 | `1, 8, 4, 5, 2, 7, 3, 6` |
| 16 | `1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11` |

This guarantees the two top seeds can only meet in the final, seeds 1–4 are in separate quarters, and seeds 1–8 in separate eighths.

### 2.3 Bye assignment

Byes go to the highest seeds, in order: seeds `1..byeCount`.

A bye is modeled as a real first-round match with one side carrying `sourceRef: { kind: 'bye' }` and `status: 'bye'`. It resolves immediately. **It is not hidden.** The public bracket renders the slot labeled "Bye" because an unexplained empty box is the single most common cause of organizer confusion.

If `byeCount >= N`, the config is invalid (more byes than players) — reject.

### 2.4 Unseeded placement

Because there are no ratings, three cases must all work:

| Case | Behavior |
|---|---|
| **Fully unseeded** (expected common case) | All positions filled by seeded shuffle. Byes go to randomly selected entrants, chosen by the same PRNG and recorded. §2.3's "byes to top seeds" has no meaning here. |
| **Partially seeded** | Seeds 1..k placed per §2.2; the rest shuffled into remaining positions. Byes go to seeds 1..min(k, byeCount), then randomly among the unseeded. |
| **Fully seeded** | Pure §2.2 placement, no randomness consumed. |

Optional constraint flag:

- `avoidSameClubRound1` — soft constraint, best-effort via rejection sampling with a bounded retry count (256), then place anyway rather than fail. Club affiliation is the only grouping signal the product has, so this is the sole available fairness heuristic.

The draw preview must state which case applied, in words: *"Unseeded random draw — 4 byes assigned at random"* vs. *"6 seeds placed, byes to seeds 1–4."* An organizer looking at a bracket needs to know whether the top-left name is there because they're the top seed or because a dice roll put them there.

### 2.5 Round naming

Derived from distance to the final, not from round index:

| Matches in round | Name |
|---|---|
| 1 | Final |
| 2 | Semifinal |
| 4 | Quarterfinal |
| 8 | Round of 16 |
| 2^k | Round of 2^(k+1) |

### 2.6 Third-place playoff

Optional, config-gated. One match in a pseudo-round after the semifinals, both sides carrying `{ kind: 'loserOf', matchId }` pointing at the two semifinals.

### 2.7 Bracket geometry (for rendering)

The renderer needs deterministic coordinates. Define, for round *r* (0-indexed) and slot *i*:

```
nodeHeight   = H
gap          = G                       // vertical gap between round-0 nodes
pitch(r)     = (H + G) * 2^r           // vertical distance between nodes in round r
y(r, i)      = pitch(r) * i + (pitch(r) - H) / 2
x(r)         = r * (nodeWidth + columnGap)
```

A connector between a child node and its parent is an orthogonal three-segment path: out from the child's right edge, vertical to the parent's centerline, in to the parent's left edge. Rendering the vertical segment as a single path per *pair* (not per child) is what allows the Advance Line animation to draw cleanly.

---

## 3. Round robin

### 3.1 Match set

Single round robin: every entrant plays every other once — `N * (N-1) / 2` matches.
Double round robin: twice — `N * (N-1)` matches.

Practical cap: `N ≤ 12` per group (66 matches). Above that, require groups.

### 3.2 Round scheduling (circle method)

Matches must be grouped into rounds where no entrant plays twice, so that courts and time slots can be allocated.

```ts
function circleRounds(ids: EntrantId[]): EntrantId[][][] {
  const list = [...ids];
  if (list.length % 2 === 1) list.push(BYE);     // sentinel
  const n = list.length;
  const rounds: EntrantId[][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: EntrantId[][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== BYE && b !== BYE) pairs.push([a, b]);
    }
    rounds.push(pairs);
    // rotate all but the first element
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}
```

Produces `n-1` rounds for even *n*, and *n* rounds with one entrant idle each round for odd *n*. For double round robin, append the same rounds with sides swapped (home/away equivalent — matters only for which side is listed first).

### 3.3 Standings computation

Per entrant, accumulate:

```
matchesPlayed, matchesWon, matchesLost
setsWon, setsLost
gamesWon, gamesLost
```

Points: `matchesWon * winPoints` (default 1). Config allows 2-for-win / 1-for-loss-played / 0-for-walkover schemes used by some leagues.

### 3.4 Tiebreaker cascade

Aligned with ITF / USTA round robin rules. Applied in order; stop at the first that separates.

**Two entrants tied:**
1. Head-to-head result
2. Higher percentage of sets won
3. Higher percentage of games won
4. Drawing of lots (recorded, never silent)

**Three or more entrants tied:**
1. Higher percentage of **sets** won among all matches in the group
2. If this separates some but not all, remove the separated entrants and re-apply from the top to the remaining subgroup
3. Higher percentage of **games** won among all matches in the group
4. Again, re-apply to any remaining subgroup
5. Head-to-head among the still-tied entrants, if it produces a complete order
6. Drawing of lots

**Critical implementation detail:** head-to-head is applied *before* percentages for two entrants but *after* for three or more. This asymmetry is in the real rules and is a common source of bugs. It is also why §3.5 exists.

### 3.5 Tiebreaker traceability

Every standings computation returns a `trace`:

```ts
interface TiebreakStep {
  tiedEntrants: EntrantId[];
  rule: 'headToHead' | 'setPct' | 'gamePct' | 'lots';
  values: Record<EntrantId, string>;   // human-readable, e.g. "4/6 sets (66.7%)"
  resolved: EntrantId[];               // who this step separated out
}
```

The public standings view renders this on demand. "Why is Priya above Marco?" must have an answer in the UI, not in a rulebook PDF.

### 3.6 Incomplete round robins

When an entrant withdraws mid-group, USTA guidance: if they completed **less than half** their matches, all their results are **expunged** and they're removed from standings. If they completed **half or more**, their completed matches **stand** and remaining matches are recorded as walkovers against them.

The engine implements both branches and flags the group as `adjusted` with the reason, so the public view can show a note rather than presenting a silently altered table.

---

## 4. Hybrid: groups → playoff

### 4.1 Group assignment

> **Naming:** round robin pools are **numbered** (`Group 1`, `Group 2`, …), never lettered. Letters are taken — `A`, `B`, `C+`, `C`, `D` are skill categories, and "Group B of the C+ draw" vs. "the B draw" is exactly the ambiguity that gets a player sent to the wrong court. This is a hard naming rule in UI and data alike.

Config: `groupCount` or `targetGroupSize`.

**If the field is seeded**, entrants are distributed by **snake seeding** so pool strength is balanced:

```
4 groups, 12 entrants:
G1: 1, 8, 9     G2: 2, 7, 10     G3: 3, 6, 11     G4: 4, 5, 12
```

**If the field is unseeded** (the common case), entrants are distributed by seeded shuffle, round-robin style across pools. There is no strength to balance, so the only guarantee is equal sizes. The preview says so plainly.

Group sizes may differ by at most 1. If they differ, the engine flags the stage, because unequal group sizes make percentage-based tiebreakers across groups unsound (see §4.3).

### 4.2 Playoff draw

Config: `qualifiersPerGroup` (typically 1 or 2).

Playoff entrants are produced as `sourceRef: { kind: 'groupRank', groupId, rank }`, so the knockout bracket renders with `G1·1`, `G2·2` placeholders before groups finish — the full tournament shape is visible from day one.

Playoff seeding: group winners above runners-up, then ordered by group number. Standard pairing avoids same-group rematches in the first playoff round:

```
2 groups, 2 qualifiers each:  G1·1 v G2·2,  G2·1 v G1·2
4 groups, 2 qualifiers each:  G1·1 v G4·2,  G2·1 v G3·2,  G3·1 v G2·2,  G4·1 v G1·2
```

Where qualifier count doesn't produce a power of two, the single-elimination rules from §2 apply — byes to the strongest qualifiers.

### 4.3 Cross-group ranking

If the config requires comparing entrants *across* groups (e.g. "best third-place finishers advance"), only matches against the top *k* finishers in each group are counted, where *k* is the smallest group size minus one. This is the standard correction for unequal group sizes and must be stated in the UI when it's applied.

---

## 5. Scoring formats

```ts
interface ScoringFormat {
  setsToWin: number;              // 2 for best-of-3, 3 for best-of-5, 1 for single set
  gamesPerSet: number;            // 6 standard, 8 pro set, 4 fast4
  tiebreakAt: number | null;      // games count that triggers a tiebreak (6, 8, or null)
  tiebreakTo: number;             // 7 standard, 10 for match tiebreak
  decidingSetMode: 'standard' | 'matchTiebreak';
  adScoring: boolean;             // false = no-ad (sudden death at 40-40)
}
```

Presets exposed in the admin UI:

| Preset | Config |
|---|---|
| Best of 3 | `setsToWin: 2, gamesPerSet: 6, tiebreakAt: 6, decidingSetMode: standard` |
| Best of 3, match tiebreak | same, `decidingSetMode: matchTiebreak` |
| Best of 5 | `setsToWin: 3, …` |
| Pro set to 8 | `setsToWin: 1, gamesPerSet: 8, tiebreakAt: 8` |
| Single set to 6 | `setsToWin: 1, gamesPerSet: 6, tiebreakAt: 6` |
| Fast4 | `setsToWin: 2, gamesPerSet: 4, tiebreakAt: 3, adScoring: false` |

### 5.1 Set validation

A set score `(a, b)` is valid iff, given `g = gamesPerSet` and `t = tiebreakAt`:

- `max(a,b) === g && min(a,b) <= g - 2` — standard win (6–0 … 6–4)
- `max(a,b) === g + 1 && min(a,b) === g - 1` — win by two after reaching `g-1` (7–5)
- `max(a,b) === t + 1 && min(a,b) === t` — tiebreak set (7–6), requires tiebreak points
- Tiebreak points `(p, q)` valid iff `max(p,q) >= tiebreakTo && max - min >= 2`

A deciding set in `matchTiebreak` mode is validated as a tiebreak alone: `(1, 0)` games with tiebreak points to 10.

The admin score entry UI derives its allowed states from this function rather than duplicating the rules — invalid scores are unreachable in the UI, not rejected after submission.

### 5.2 Non-standard outcomes

| Outcome | Behavior |
|---|---|
| `completed` | Normal. Winner from completed sets. |
| `retirement` | Score at time of retirement is recorded; opponent advances. Sets completed count toward standings; the partial set does not. |
| `walkover` | No score. Opponent advances. Counts as a match played and won; contributes **no** sets or games to standings percentages. |
| `default` | As walkover, but attributed to a code violation. Distinct label in UI. |
| `unfinished` | Suspended, no result. Match stays open; bracket slot remains unresolved. |

Walkovers contributing no games/sets is important: counting a walkover as 6–0 6–0 would distort round robin percentage tiebreakers.

---

## 6. Test strategy

The engine's test suite is the thing that makes this product trustworthy. Required coverage:

1. **Exhaustive structural tests** — generate single elimination for every `N` in 2–128 and assert: correct match count (`N-1` plus byes), every entrant appears exactly once in round 1, bye count correct, no orphaned `sourceRef`.
2. **Seeding-mode matrix** — run every `N` in 2–128 three times: fully unseeded, partially seeded (k = 2, 4, 8), fully seeded. Assert seed separation (1 and 2 in opposite halves, 1–4 in separate quarters, 1–8 in separate eighths) *only* in the seeded modes, and assert correct bye attribution in all three. The fully-unseeded path is the default in production and must be tested first, not last.
3. **Round robin completeness** — every `N` in 2–12: every pair appears exactly once, no entrant appears twice in any round, round count correct.
4. **Tiebreaker fixtures** — encode the worked examples from published ITF/USTA round robin guidance as test cases, including three-way ties and the half-complete withdrawal branch.
5. **Score validation property tests** — for each preset, enumerate all `(a,b)` pairs in `0..15` and assert the valid set matches a hand-written table.
6. **Determinism** — same inputs plus same seed produce byte-identical output across 1000 runs.
7. **Hybrid integration** — groups → playoff for 2/4/8 groups × 1/2 qualifiers, asserting no same-group first-round rematches.
8. **Small-field tolerance** — `N` = 2, 3, 4, 5 for both formats. These are the realistic Open and A draws, and they're where off-by-one bugs hide. A 3-entrant round robin and a 3-entrant single elimination (one bye, one real first-round match) must both generate cleanly.
9. **Category independence** — the same entrant list produces identical output regardless of what the application calls the draw. A guard against category ever leaking into the engine.
