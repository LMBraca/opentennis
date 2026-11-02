# OpenTennis — Design System & Motion Specification

**Status:** Draft v0.1
**Last updated:** 2026-11-01
**Parent:** [`../PRD.md`](../PRD.md)

> The requirement is that this product must not look generated. That's achievable, but only by replacing default decisions with deliberate ones. Every section below exists to remove a default.

---

## 1. Art direction: *Court Lines*

Tennis owns one of the strongest visual identities in sport and almost no software uses it. The identity is three things:

1. **A surface** — clay, hard court, grass. Saturated, matte, tonal.
2. **A line** — crisp white, mechanically straight, dividing the surface into meaning.
3. **A ball** — one optic-yellow object, the only thing in the frame that moves.

The entire system derives from those three. Surfaces are backgrounds. Lines are structure, dividers, and bracket connectors. The ball's optic yellow is reserved exclusively for *live right now*.

### Consequences of the premise

| Principle | What it means in practice |
|---|---|
| **Depth from line, not shadow** | Cards are separated by 1px rules and surface tint shifts. There is no `box-shadow` in the system except a single modal scrim elevation. |
| **Two radii, total** | `2px` for data surfaces (cards, match nodes, table cells) and `9999px` for pills and avatars. Nothing else. The uniform-8px-rounded look is the most recognizable tell of unconsidered UI. |
| **One accent, enforced** | Clay is the brand accent. Optic yellow is a *state*, not a color choice. Reviewers should reject any PR using optic yellow decoratively. |
| **Editorial, not centered** | Content sits on a left baseline against hard vertical rules. Centered hero stacks are not used anywhere in the product. |
| **Numerals are the hero** | Scores are the most-read content. They get the display face, tabular figures, and the largest type on screen in the match context. |

---

## 2. Color

Warm neutrals — a cool gray UI next to clay orange reads cheap. Everything is tinted toward the surface.

```css
:root {
  /* Neutrals — warm */
  --ink-900: #14120F;   /* primary text, near-black with a clay bias */
  --ink-700: #3A352E;
  --ink-500: #6B6358;   /* secondary text */
  --ink-300: #A9A096;   /* tertiary, placeholders */
  --line-200: #DDD6CB;  /* hairline rules */
  --line-100: #EBE5DB;  /* subtle dividers */
  --paper-50: #F7F4EE;  /* page background */
  --paper-0:  #FFFFFF;  /* raised surface */

  /* Surfaces — the three courts */
  --clay-600: #A8472A;  /* accent pressed */
  --clay-500: #C65D3B;  /* ACCENT — brand, primary action */
  --clay-100: #F6E3DA;  /* accent wash */
  --hard-600: #1B4668;
  --hard-500: #26618F;  /* data/secondary, charts, seeds */
  --grass-500: #2F5D3A; /* confirmed, completed */

  /* State */
  --optic-500: #D4E04B; /* LIVE ONLY. Never decorative. */
  --optic-glow: #EDF48F;
  --fault-500: #A8261C; /* error, default, retirement */
}
```

### Dark mode — *Night Session*

Not an inversion. Floodlit night tennis: the court stays saturated, the surround goes black, the ball gets brighter.

```css
:root[data-theme='dark'] {
  --ink-900: #F2EEE6;
  --ink-500: #A49C90;
  --ink-300: #6E675C;
  --line-200: #332E27;
  --line-100: #242019;
  --paper-50: #100E0B;
  --paper-0:  #191610;

  --clay-500: #D97250;   /* lifted for contrast on near-black */
  --clay-100: #2E1A12;
  --hard-500: #4A90C4;
  --grass-500: #4C8A5B;
  --optic-500: #E2F05A;  /* brighter — it's under lights */
}
```

Both themes must be checked: `@media (prefers-color-scheme: dark)` as the default signal, `:root[data-theme]` overriding in both directions.

### Contrast requirements

All body text ≥ 4.5:1, large display text ≥ 3:1. `--optic-500` on `--paper-50` fails for text and must only ever be used as a **fill, rule, or indicator** — never as text color on light. Live labels on light backgrounds use `--ink-900` text next to an optic rule.

---

## 3. Typography

| Role | Face | Usage |
|---|---|---|
| Display | **Archivo** (variable, width + weight axes) | Headlines use the expanded axis at 600. Scores use the condensed axis at 700. One family, two personalities — this is what makes the scoreboard feel native to the brand rather than bolted on. |
| Text | **Instrument Sans** | All UI, body, labels. |
| Mono | **Martian Mono** | Court codes, timestamps, IDs. Sparingly. |

### Rules

- `font-variant-numeric: tabular-nums` is set globally on `:root` and never unset. A score that shifts the layout when it changes from 9 to 10 is a defect.
- Scores additionally use `font-feature-settings: 'ss01'` where available for a flat-topped 1 — it reads as a scoreboard.
- Labels are uppercase, 11px, `letter-spacing: 0.08em`, `--ink-500`. These are the "painted line" of the type system.
- Player names are never truncated with an ellipsis mid-surname in the bracket. They shrink to a defined minimum (13px) and then wrap to two lines. Seeing "Vandenberg…" instead of a name is worse than a taller node.

### Scale (4px baseline, 8px rhythm)

```
display-xl  56 / 56   condensed 700    champion name, final score
display-l   40 / 44   condensed 700    match detail score
display-m   28 / 32   condensed 700    bracket node score, standings numerals
title-l     22 / 28   expanded 600     page titles
title-m     17 / 24   expanded 600     section headers
body        15 / 22   text 400
body-sm     13 / 18   text 400         bracket node names
label       11 / 12   text 500 ·       uppercase, tracked
```

---

## 4. Layout & components

### Grid

4px baseline. Spacing scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`. No arbitrary values.

Public pages use a 12-column grid with a hard left rule at the content edge — a 1px `--line-200` vertical line running the full page height, echoing a court sideline. Content hangs off it. This one detail does more for "designed" than any amount of gradient.

### The match node

The system's signature component. Appears in brackets, schedules, and result lists.

```
┌─────────────────────────────────────┐
│▌¹ Alvarez / Chen           6  7  –  │   ← winner: ink-900, clay left rule
│  ⁴ Okonkwo / Reid          4  6  –  │   ← loser:  ink-500
└─────────────────────────────────────┘
      ↑ seed superscript         ↑ tabular score columns
```

- Fixed-width score columns so every node in a bracket aligns vertically — columns, not inline text.
- 2px left rule: `--clay-500` for the winner's row, `--optic-500` animated for a live match, `--line-200` for undecided.
- Seeds as superscript, `--hard-500`. **Often absent** — most draws are unseeded, since the product has no ratings. The node must look deliberate with no superscript at all, not like something failed to load. Don't reserve space for a missing seed.
- Undecided sides render their source ("Winner of QF2", "Group 2 · 1st") in `--ink-300` italic.
- Retirement/walkover shown as a `label`-styled suffix: `RET`, `W/O`, `DEF`.

### The category system

A tournament runs up to twelve draws at once (six categories × two disciplines), so category is a primary navigational axis and appears on nearly every surface.

**Categories are never color-coded.** Six categories invites six hues, which would wreck the one-accent rule in §1 and leave the palette meaningless. Category is expressed **typographically and positionally** instead:

```
 ╷╷╷╷╷╷   OPEN      ← rank ticks: filled = position in the ladder
 ╷╷╷╷╷    A
 ╷╷╷╷     B
 ╷╷╷      C+
 ╷╷       C
 ╷        D
```

- **Category chip**: the code in `label` style (uppercase, 11px, tracked) inside a 2px-radius box, `--ink-900` on `--paper-0` with a 1px `--line-200` border. Identical for every category.
- **Rank ticks**: a 6-segment indicator, filled to the category's `rank`, in `--ink-300`. Gives instant relative position without a legend or a color key. Decorative only — always accompanied by the text code, never the sole signifier.
- **Ladder order is enforced everywhere.** `Open → A → B → C+ → C → D`, by `rank`, never alphabetically. An alphabetical sort yielding `A, B, C, C+, D, Open` is a bug.
- **Discipline** is a separate chip, not fused into the category: `C+` · `DOUBLES`. Two independent dimensions, rendered as two independent chips, because the UI filters on each separately.

### The category grid

Shared component between the admin setup screen and the public landing page — same geometry, different affordances. Categories as rows against the page's left rule, disciplines as columns.

- Desktop: a true grid, column headers in `label` style, each cell a compact surface showing format, entrant count, and status.
- Phone: collapses to a **vertical list grouped by category**, each category a section header with its singles and doubles draws as two rows beneath. Not a horizontally scrolling table — this is the primary navigation and must not require a sideways swipe.
- `notRun` cells render at 40% opacity with a `label`-styled "NOT HELD", no interaction. Empty cells (never offered) are blank, not greyed — the two states must be visually distinct, because one means "cancelled" and the other means "we don't run that."
- Live draws get the optic-yellow rule treatment, consistent with everything else. On a busy day the grid is the fastest read of what's happening.

### The entry form

The only public page where someone types rather than reads, and for many players the first thing they ever see of the product. It carries disproportionate weight for how legitimate the tournament feels.

- **One column, left-aligned on the page rule.** No centered card floating in space.
- **Four required fields** — first name, last name, email, phone — and that is real friction on a phone in a car park. So: `inputmode` and `autocomplete` set correctly on every one (`given-name`, `family-name`, `email`, `tel`), the numeric keypad for phone, and no field the browser can't autofill. Required fields are marked by a `label`-styled "REQUIRED" on the field, never by a red asterisk.
- Category × discipline selection reuses the **category grid** component as a multi-select — the same object the player will later read results from. Learning it once pays off twice.
- Arriving from a per-event QR (§4.4 of the PRD) **pre-selects that cell** and scrolls it into view, with the selection visibly made rather than silently applied. The player must be able to tell the form knew where they came from.
- Fee-free in v1, so no pricing row; the grid cells show format and entrant count only.
- Inline validation on blur, never on keystroke. Errors sit beneath the field in `--fault-500` with a 2px left rule, matching the match-node rule treatment.
- **The duplicate-email error is the one that needs care.** "That email is already registered" reads as an accusation, and the household-sharing case (§4.1) means it will hit innocent people. Copy states the situation and the way out: *"This email is already registered for this tournament. If you're sharing an address with a family member, ask the organizer to add you directly."* Never a bare "invalid".
- The **partner field** for doubles takes an email (preferred) or a name, as a combobox over already-submitted entries with free text always allowed. It must never block on a partner not being found.
- Submit is a single full-width button in the thumb zone on phone. Submitting shows the Court Loader inline inside the button, not a page-level overlay.
- Confirmation is a **page, not a toast** — it carries the bookmarkable status URL and has to survive being screenshotted, which is what people will actually do with it.

### The review queue

An admin clearing 60 submissions is doing repetitive triage, so the design target is keyboard throughput, not visual richness.

- A dense list, one submission per row, `body-sm`. Deliberately tighter than the rest of the admin — this is a work surface.
- The email lookup result sits inline on the row, not behind a click: `returning · 4 prior tournaments` in `--ink-500`, or `new` in `--ink-300`. A fact, not a confidence score.
- **Near-identical names sort adjacent** so two Mike Smiths land next to each other and the admin sees it unaided. No highlight, no warning badge, no "possible duplicate" chip — the product makes no claim about whether they're the same person. Adjacency is the entire affordance.
- **Keyboard-first**: `J`/`K` to move, `A` to accept, `R` to reject, `E` to edit, `⌘↵` to bulk-accept the selection. Shortcuts are shown in a persistent footer legend, not hidden in a help modal.
- Accepted rows animate out with the **Standings Reorder** FLIP motion (§5.7) rather than vanishing — the list closing the gap confirms the action without a toast.
- Pending counts on the category grid use the plain category chip with a count, in `--ink-900`. **Not optic yellow** — pending is not live.

### Print artifacts: the QR sheet

With no email channel, a sheet of paper on a clubhouse wall is a primary interface. It should look like it came from the same product as the bracket, which means the system has to work in **one ink on white at 300dpi** — no surface tints, no dark mode, no optic yellow.

- **Scannability wins every conflict.** Error correction level Q, full quiet zone, pure `--ink-900` on white, nothing overlaid or inset. No logo in the code, no rounded modules, no gradient. A clever QR that fails at dusk in a corridor has cost the tournament an entrant.
- **Hierarchy below the code**, in the display face: tournament name at `title-l`, then the category chip and discipline chip side by side, then format and dates at `label`. The code is the largest object on the page by a wide margin.
- **"Scan to enter"** set in `label` style. One instruction, no paragraph.
- **The page rule survives into print** — the same 1px vertical line at the content edge that runs through the web UI. It's the cheapest possible way for a printed sheet to read as the same system.
- **Two layouts**: one-up at ~120mm code width for a single poster, and 4-up for a page carrying every category at once. The 4-up variant keeps each code at ~60mm, which still scans reliably from a metre away.
- Clay accent is permitted here as a single flat element — a rule or a filled category chip — since one spot colour prints cleanly. Never a gradient, never behind the code.

### Depth model

Exactly three levels:

1. **Page** — `--paper-50`
2. **Surface** — `--paper-0`, separated by a 1px `--line-100` rule, no shadow
3. **Overlay** — modal/sheet, `--paper-0` with a single `0 8px 32px rgb(20 18 15 / 0.12)` and a `rgb(20 18 15 / 0.4)` scrim

Nothing else casts a shadow.

---

## 5. Motion specification

Nine named motions. If an animation in the product isn't one of these, it needs a design decision, not a default `transition-all`.

### Easings & durations

```css
--ease-out-court:   cubic-bezier(0.16, 1, 0.30, 1);    /* primary — decisive arrival */
--ease-in-out-rally: cubic-bezier(0.65, 0, 0.35, 1);   /* reversible, looping */
--ease-spring-pan:  spring(stiffness 260, damping 30); /* bracket viewport */

--dur-micro:  120ms;  /* hover, press, focus */
--dur-enter:  220ms;  /* element appearance */
--dur-layout: 320ms;  /* FLIP, reorder, connector draw */
--dur-scene:  480ms;  /* shared element, route change */
--dur-reveal: 900ms;  /* champion only */
```

Nothing exceeds 1s except Champion Reveal. Nothing animates a property other than `transform`, `opacity`, `clip-path`, `stroke-dashoffset`, or `filter`.

### The nine motions

**1. Draw Reveal** — *trigger: a draw is published or the bracket first paints.*
Nodes enter round-by-round, left to right. `translateY(8px) → 0`, `opacity 0 → 1`, `--dur-enter`, `--ease-out-court`, 28ms stagger within a round, 90ms offset between rounds. Connectors draw after their round's nodes land. The whole sequence for a 32-draw completes in ~1.1s and is the product's first impression.

**2. Score Tick** — *trigger: a live score changes.*
Only the changed digit moves: it slides vertically out while the new digit slides in, 120ms, `--ease-out-court`, inside an `overflow: hidden` digit cell. Tabular figures mean zero reflow. The match node briefly tints `--clay-100` and fades back over 400ms so a glance catches *which* match changed.

**3. Advance Line** — *trigger: a match completes.*
The SVG connector from the completed node to its parent draws via `stroke-dashoffset`, 320ms, `--ease-out-court`. On arrival, the winner's name crossfades into the parent slot (80ms out, 120ms in) and the parent's left rule shifts from `--line-200` to `--clay-500`. This is the single most satisfying moment in the product and deserves the most attention.

**4. Live Pulse** — *trigger: match status is live.*
The node's 2px left rule animates `opacity 0.55 → 1`, 1600ms, `--ease-in-out-rally`, infinite alternate, in `--optic-500`. Plus a 4px dot in the header. No scaling, no glow bloom — a rule that breathes. Killed entirely under `prefers-reduced-motion` (replaced with a static full-opacity rule).

**5. Bracket Pan & Zoom** — *trigger: drag, wheel, pinch.*
Pointer-driven, 1:1 with no easing while dragging. On release, inertial with `--ease-spring-pan`. Pinch-zoom clamped `0.4×–2.5×`, anchored to the gesture midpoint. Double-tap fits the current round; two-finger double-tap fits the whole draw. The transform lives on a single wrapping element so the browser composites it — this is what holds 60fps at a 64-draw.

**6. Shared Element** — *trigger: tapping a match node.*
The node's score block is the shared element. It morphs position and scale into the detail sheet's header over `--dur-scene` with `--ease-out-court`, while the sheet's body content enters with a 60ms-delayed fade. Implemented with the View Transitions API where supported, Motion's `layoutId` as fallback. Reverses exactly on dismiss.

**7. Standings Reorder** — *trigger: round robin standings change.*
FLIP on table rows, `--dur-layout`, `--ease-out-court`. Rows that moved get a `--clay-100` background wash that fades over 600ms. Rows that crossed the qualification line get a brief `--grass-500` or `--fault-500` left rule. The table should *show* that something changed, not silently re-sort.

**8. Champion Reveal** — *trigger: the final completes.*
No confetti. Sequence over `--dur-reveal`:
- `0–200ms` — bracket pans and zooms to the final (`--ease-spring-pan`)
- `150–450ms` — all connector lines retract via `stroke-dashoffset`, outward from the final
- `300–700ms` — a `--clay-500` wipe sweeps left-to-right behind the champion's name (`clip-path` inset)
- `500–900ms` — champion name scales `1 → 1.06`, settles to `1.0`, display-xl weight
- `900ms` — a share card becomes available

**9. Court Loader** — *trigger: any load > 200ms.*
Not a spinner. A 6px optic-yellow ball traverses a bezier arc over a 1px baseline, 1200ms, `--ease-in-out-rally`, infinite, with a slight squash at the arc's low point. Inline at 16px, standalone at 48px.

### Reduced motion

Under `prefers-reduced-motion: reduce`:

- All infinite loops stop (Live Pulse becomes static, Court Loader becomes a static progress rule).
- Transform-based transitions become ≤80ms opacity crossfades.
- Draw Reveal, Advance Line, and Champion Reveal become instant state changes.
- Pan/zoom remains fully functional — it's user-driven input, not decoration.

This is a hard gate, not a nice-to-have. Vestibular-triggering motion in a sports app that people check 20 times a day is a real harm.

---

## 6. Mobile specification

Mobile isn't a reduced desktop — the bracket genuinely does not fit, and pretending otherwise is why every competitor's mobile bracket is bad.

### Breakpoints

```
<  640   phone      Round Column bracket, bottom sheets, single column
≥  640   tablet     Full bracket with pan, two columns
≥ 1024   desktop    Full bracket + minimap, persistent side panel
≥ 1440   wide       Full bracket at 1× without panning for ≤16 draws
```

### Bracket on phone — Round Column

The default. One round fills the viewport width:

- Sticky round tabs at top, horizontally scrollable, with the active round centered and a count of live matches per round.
- Horizontal **snap scroll** between rounds — `scroll-snap-type: x mandatory`. A swipe moves exactly one round, matching the mental model of moving through the draw.
- Nodes stack vertically with generous 16px gaps; full node width means names never truncate.
- A thin progress rail at the bottom shows position in the draw.
- "Jump to final" and "Follow a player" (→ Path View) as persistent actions.

### Category switching on phone

With up to twelve draws per tournament, moving between them can't mean returning to the landing page each time.

- A **category + discipline chip pair sits in the sticky header** of every draw view, tappable to open a bottom-sheet picker showing the full grid.
- The picker preserves the current discipline when you change category, and vice versa — moving from `C+ Doubles` to `C Doubles` is one tap, not two choices.
- Swiping horizontally is already claimed by round navigation inside a bracket, so category switching is deliberately tap-only. Overloading the same gesture with two meanings is how a bracket becomes unusable.

### Path View

Pick an entrant, get their vertical route: played matches resolved with scores, upcoming matches as "Winner of …", the final at the bottom. This is the view Priya actually wants and nobody ships it.

### Score entry on phone — courtside mode

Marco is standing in the sun, one-handed, on a phone he's holding above his head to see past the glare. Requirements:

- Game count entered with **stepper buttons at 56×56px minimum**, positioned in the bottom third of the screen (thumb zone). No text inputs for games, ever.
- Numeric keypad appears only for tiebreak points, only when the set reaches the tiebreak trigger.
- One set per screen, swipe to advance. The set is committed when it becomes valid per the scoring-format validator.
- Match identity pinned at the top at all times — both names and the round — because entering a score on the wrong match is the worst possible error and it happens.
- A `Retire / Walkover / Default` secondary action behind one tap, never a buried menu.
- Confirmation step before submitting, showing the full score as it will appear publicly.
- A failed submission shows an inline error on the match itself with a **retry** button, never a toast that can be missed and never a silent failure. There is no offline queue (PRD §2), so a lost request has to be visible where the work was done.
- **High-glare legibility.** This screen is used outdoors in direct sun, which argues for the light theme's full `--ink-900`-on-`--paper-0` contrast and against any mid-tone greys in the score numerals. Score digits here use `display-l` minimum.

### Touch and gesture rules

- Every target ≥44×44px, ≥8px apart.
- Pinch-zoom on the bracket must not be blocked by `touch-action: none` on the page — scope it to the bracket surface only.
- Bottom sheets for all detail views, with a drag-to-dismiss handle and a safe-area inset bottom pad.
- No hover-dependent information anywhere. Everything reachable by tap.

---

## 7. Banned patterns

These are rejected in review. The list exists because they are the specific tells the brief is asking to avoid.

**Color & surface**
- Purple/indigo/violet anything. Not in the palette, not as a fallback.
- Multi-stop gradients as a background or on buttons. One permitted gradient exists: the Champion Reveal wipe.
- Glassmorphism — `backdrop-filter` blur cards floating over blurred colored blobs.
- Blurred radial "glow" orbs behind content.
- Stock Tailwind palette values (`zinc-800`, `slate-900`, `blue-500`). Only tokens from §2.
- **Color-coding the six skill categories.** One accent, enforced. Categories are typographic — see §4.
- Using optic yellow for anything other than live-right-now.

**Layout & form**
- Uniform `rounded-lg` on everything. Two radii, per §1.
- Centered hero stack with a "✨ Now in beta" pill above an H1.
- Shadow as the only separation between surfaces.
- Undifferentiated 3-across card grids as a layout default.
- Full-width 1440px content with no vertical structure or rules.

**Type & content**
- Emoji as iconography in the UI (fine in user-generated content).
- Inter at 16/24 for every piece of text in the product.
- Proportional numerals anywhere near a score.
- Placeholder copy that survives to production ("Lorem", "Your tagline here", "Welcome to our platform").
- AI-tell copy patterns: "Seamlessly", "Effortlessly", "Elevate your", "— it's that simple."

**Motion**
- `transition: all`.
- Confetti. Ever.
- Scroll-triggered fade-up on every section.
- Animations over 1s outside Champion Reveal.
- Looping animation with no `prefers-reduced-motion` guard.
- Spinners (the Court Loader exists for this).

---

## 8. Quality gates

A build ships only if all of these hold:

| Gate | Threshold |
|---|---|
| CLS | < 0.05 — skeletons match final geometry exactly |
| LCP (public bracket, 4G, mid-range Android) | < 1.5s |
| Bracket pan frame rate (64-draw, 2021 mid-range Android) | ≥ 55fps sustained |
| Contrast | WCAG 2.2 AA, verified in both themes |
| Keyboard | Bracket fully traversable — arrows move between rounds and slots, Enter opens detail, Esc closes |
| Screen reader | Each match node announces as "Round of 16, match 3: Alvarez and Chen, seed 1, defeated Okonkwo and Reid, seed 4, 6–4, 7–6" |
| Reduced motion | Every §5 motion verified under the media query |
| Horizontal overflow | Page body never scrolls horizontally; only the bracket surface and the results crosstab scroll, each in their own container |
| Touch targets | All ≥44px, automated check in CI |
