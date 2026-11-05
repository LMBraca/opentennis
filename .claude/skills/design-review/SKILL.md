---
name: design-review
description: Audit the UI for "vibe-coded" design tells before shipping. Use when changing CSS, adding a page or component, or when the user says the design looks AI-generated, generic, or templated.
---

# Design review

Catch the signatures of AI-generated design before they ship. Run the
detector, then judge the things a detector cannot.

## 1. Run the detector

```bash
node .claude/skills/design-review/audit.mjs
```

Static checks always run. The live checks need a server, so start one first
for the full pass:

```bash
cd apps/web && pnpm build && pnpm start -p 3000   # then re-run the audit
```

Exit code is the number of findings, so it can gate a commit. `AUDIT_PAGES`
overrides which routes are measured.

**`pkill -f "next start"` does not kill the server** — Next renames the
process to `next-server`, so the old one survives, the new one fails to bind,
and you measure the previous build while believing you measured the new one.
Use `pkill -f next-server`.

## 2. The rules the detector enforces

Each one is a documented tell, not a preference.

| Rule | Why |
|---|---|
| `accent-edge-card` | A 3–4px coloured stripe on a card's left edge is the single most-cited tell — "as reliable for AI design as em-dashes are for AI text". A card that needs a stripe to look important has a hierarchy problem. Blockquotes are exempt; a left rule there is centuries old. |
| `all-caps-label`, `page-metrics` → uppercase 0% | Anthropic's `frontend-design` skill lists "using all caps for labels" and "a tracked-out ALL-CAPS eyebrow label above every heading" as template chrome. This repo peaked at **49% of visible text** on the home page and 86% in admin. The target is zero, not "less". |
| `arrow-in-link-text` | "All updates →" and "← Updates". An arrow pasted onto a label in place of saying where it goes. |
| `middle-dot-meta` | `[a, b, c].join(' · ')`. Template chrome that appears whatever the subject. |
| `page-metrics` → ≤ 2 radii | Uniform 8px-rounded everything is the most recognisable tell of unconsidered UI. |
| `page-metrics` → no overflow | Layouts break at widths nobody prompted for. Checked at 390 and 768. |
| `gradients`, `glassmorphism`, `coloured-shadow` | Purple glows, frosted panels and tinted shadows are shortcuts for "modern". |
| `vibecode-purple` | Lavender/violet is the default accent of every AI builder. |
| `dark-mode-default` | Dark mode should be a brand decision, not a default. |
| `emoji-as-icon` | Emoji as an icon system. |
| `undefined-token` | Not from the literature — from this repo. `var(--space-5)` does not exist, and CSS drops the **whole declaration** silently, so a button shipped with no horizontal padding for weeks. |

## 3. Judge what the detector cannot

Read `docs/design-system.md` first — it holds the palette, type system and
the layout primitive. Then check:

- **Is the copy specific?** "Seamless", "effortless", "unlock your potential"
  are placeholders that survived. Every string should only make sense for
  *this* product.
- **Are stats earned?** A row of big numbers nobody asked for is decoration.
  This repo shipped "2 Tournaments / 6 Categories / 71 Entrants" and the
  user's reaction was "this section is unnecessary" — aggregate counts across
  unrelated tournaments are a vanity metric.
- **Is every card the same card?** Identical icon-above-text cards in a grid
  mean no editorial decision was made about what matters most.
- **Does the hero earn its height?** A centred headline in a generic sans with
  a badge above it is the default composition of every AI builder.
- **Is one element doing the work of three?** Repeat one strong primitive
  rather than inventing a variant per section.

## 4. One header, one body — never build a second

`components/page-header.tsx` is the ONLY masthead. `PageBody` is the only
content container. Pages pick `variant` (`page` for a public destination,
`tool` for an admin workspace) and `width`; they do not get to pick a
gutter, a title size or a band height.

This exists because there used to be twelve headers. Six pages rendered the
logo and six did not. The article page had a parallel `articleHero` /
`articleTitle` / `articleMeta` set. Admin invented `club` / `who` /
`signOut`. Unifying the CSS could not fix it, because the MARKUP differed —
the only fix is one component with a fixed slot order.

If a page needs something the slots do not offer, the question is whether it
belongs in a masthead at all.

## 5. Repo-specific rules

These come from `docs/design-system.md` and are not negotiable here:

- **Optic yellow (`--optic-500`) means "live right now" and nothing else.**
  Never decorative. I broke this once by using it as a 2px rule under a hero.
- **Two radii in the whole product**: `--radius-data` (2px) and
  `--radius-pill`.
- **One shadow token**, for modals. Depth comes from line weight and surface
  tint.
- **No uppercase at all.** I kept arguing for "just the section label"; the
  official `frontend-design` skill says drop it, and dropping it is what
  finally made the pages read as designed rather than generated. Drop
  `--type-label-tracking` with it — tracking is a capitals device.
- **Warm neutrals.** A cool grey UI beside the brand olive reads cheap.
- **One masthead component**, see section 4. `app/hero.module.css` is gone;
  composing shared CSS was not enough, because the markup differed too.

## 6. When the user says it still looks AI-generated

Do not guess, and do not fix the first thing you think of. **Measure which
elements actually contribute**, then fix the top contributors:

```js
// in Playwright, on the page in question
await p.evaluate(() => {
  const by = {};
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.textTransform !== 'uppercase') continue;
    const t = [...el.childNodes].filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join('').trim();
    if (!t) continue;
    const k = (el.className || el.tagName).toString().split(' ')[0];
    by[k] = (by[k] || 0) + t.length;
  }
  return Object.entries(by).sort((a, b) => b[1] - a[1]);
});
```

That ranking turned "the design still feels off" into "nine rules account for
all of it" in one step.
