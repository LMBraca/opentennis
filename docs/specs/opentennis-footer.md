# OpenTennis footer fix (desktop + mobile)

Repo path: docs/specs/opentennis-footer.md. Base: main 123546e678874d21cbef26408c312ccb639ca35a.

## Problem (Luis, 2026-11-12)
- The footer "spazzes out": it jitters, jumps, or reflows while the page loads or scrolls.
- The anchoring to the bottom feels wrong.
- The footer content alignment looks dated and uneven compared with modern sites. Known from QA on PR #16: the footer stops short of the right edge.
- The same fixes apply on mobile.

## Scope
Public and admin layouts that render the site footer. Only the footer and the page-shell layout rules it depends on. No content or copy changes beyond what Design specifies, and no new links.

## Acceptance criteria
1. No layout shift or jitter. The footer doesn't move, flicker, or resize on load, on scroll (including iOS rubber-band and address-bar collapse), on route change, or when fonts or images load. Measured CLS from the footer is 0 on home, a tournament page, login, and forgot-password.
2. Sticky-bottom anchoring. On short pages the footer sits at the bottom of the viewport (min-height page shell using flex column with 100dvh or equivalent, not position: fixed). On long pages it follows the content naturally. It never overlaps content and never floats mid-screen.
3. Full width. The background runs edge to edge with no gap at the right or left edge at any width from 320 to 1920 px. There's no horizontal scroll.
4. Modern alignment, per Design's spec. Inner content sits in the same max-width container and gutters as the header and body. Columns or groups align to a consistent grid, baseline-aligned text, consistent spacing tokens, and a clear hierarchy (brand / links / meta such as "Open Tennis, Mexicali, México").
5. Mobile at 320, 375, and 390 px. It stacks into a clean single column (or Design's pattern), with tap targets of at least 44 px, no overflow, respect for safe-area insets, and no jitter.
6. ES default and EN translation both lay out correctly. No new hardcoded English.
7. Keyboard focus order and visible focus on the footer links; readable contrast (WCAG AA).
8. Build gate: full tests, typecheck, lint, and `pnpm --filter @opentennis/web build` recorded in the PR body for the exact head; Ready preview for that SHA.
9. QA provides before/after screenshots at 1440 and 390 for home, a tournament page, a short page (login), and admin. Design PASS is required.

## Out of scope
Header changes, content changes, and email templates.

## Addendum (Luis, 2026-11-12 10:55 AM PT): minimal auth layout
Luis: the forgot-password page shouldn't give access to other pages through the header. Copy how other sites do it.

10. Auth pages use a dedicated minimal layout (a route group such as `(auth)` with its own layout), not the public site shell. This covers login, forgot-password, reset-password (token page), and admin invite accept/set-password, plus their error and success states.
11. The auth layout has no site header nav, no menu or hamburger, no search, and no full site footer. Design should benchmark GitHub, Google, Stripe, and Vercel auth pages and pick the pattern. The expected pattern is a centered card with the logo on top (the logo may link to home), the form, and a single contextual link ("Volver a iniciar sesión" / "Back to sign in"). Below it, at most a slim legal or language line.
12. Language switching still works on auth pages (ES default, EN), in whatever minimal form Design picks.
13. The same jitter-free, full-height, mobile-safe rules (1–7) apply to the auth layout at 1440, 390, and 320.
14. Regression: public pages and admin keep their normal header and the new footer. Auth redirects and flows (login, request reset, reset with token, invite accept) still work end to end.


## Design — footer + minimal auth layout

**Owner:** Design · **Date:** 12 Nov 2026 (America/Tijuana) · **Against:** `main` @ `123546e` · **Implements:** criteria 1–14 above
**Mockups** (label "MOCKUP — not the running app"; rendered from real tokens + `public/brand/*.png`): `/workspace/design/opentennis-footer/mockups/`
`footer-desktop-1440.png`, `footer-mobile-390.png`, `footer-mobile-320.png`, `auth-login-desktop-1440.png`, `auth-login-mobile-390.png`, `auth-login-mobile-320.png`.
Reference CSS used for the mockups (the target rules, not app code): `/workspace/design/opentennis-footer/reference.css`. Benchmark captures: `/workspace/design/opentennis-footer/bench/`.

### Lead decisions applied
1. Login, forgot-password, reset-password and invite accept get **no site footer**; they move to the minimal auth layout (slim language + meta line only). `InvitePageShell` stops rendering `SiteFooter`.
2. **Admin stays footer-free** (tool area). Only regression: header and layout unchanged. Closed.
3. Short-page shots and criteria 1–2 use **not-found** (`/no-existe`) and **search with no results**. Login and forgot-password move to criterion 13 (auth layout).
4. Logos get a **reserved box** (width + height) at both breakpoints.
5. Hardcoded aria-labels become **dictionary keys**.
6. A meta line is added, matching the Mexicali footer in the emails.

---

### D1. Jitter, anchoring and right-edge root causes (read from code on `123546e`)

| # | Cause (file) | Symptom | Fix |
|---|---|---|---|
| R1 | **Nine `(site)` page modules set `.page { min-height: 100dvh }`** (`home`, `media`, `search`, `tournament`, `draw`, `match`, `enter`, `blog`, `player`). They sit *inside* `site.module.css .content`. | Content is always at least one viewport tall, so the footer is **always below the fold, even on a short page**. That is why "the anchoring feels wrong". On iOS, `dvh` changes as the toolbar collapses or expands mid-scroll, so the content height and the footer move while you scroll. | Remove `min-height` from those page modules; the shell owns the height. Keep their `background: var(--paper-50)`. |
| R2 | `site.module.css .shell { min-height: 100dvh }` and `globals.css body { min-height: 100dvh }` | `dvh` resizes on scroll on iOS and Android, which reflows the column. | Shell: `min-height: 100vh; min-height: 100svh;`. `svh` is stable and equivalent to `dvh` for a page that doesn't scroll. Remove `min-height` from `body` (the shell owns it). |
| R3 | **Duplicate footers inside `PageBody`**: `app/not-found.tsx` and `app/admin/invite/invite-page-shell.tsx` (used by forgot, reset, reset-invalid, invite, invite-invalid) | The band sits inside `PageBody`'s `max-width: 72rem` plus gutters, so it **stops short of both edges** (the reported right-edge gap). It's also never bottom-anchored. `PageBody` padding-bottom of 64 plus footer margin-top of 64 leaves a 128 px gap. `invite.module.css .page { min-height: 100dvh }` plus the footer means the page always scrolls. | Not-found renders inside the shared site shell (D3). Auth pages move to the auth layout (D5). The only `SiteFooter` call site left is the site shell. |
| R4 | Footer `<Image>`s use `width={1600}`/`{1387}` with no `priority` → production HTML: `loading="lazy"`, `srcset … w=1920 1x, w=3840 2x` | A **3840 px PNG is decoded for a 34–62 px mark**, lazily, so the marks pop in or flicker as the footer scrolls into view. | Pass intrinsic props near render size so Next emits small candidates: club `width={218} height={84}`, sponsor `width={212} height={124}`. Keep lazy loading with the box reserved (R5). The header can keep `priority`. |
| R5 | `.mark { height: 34px→42px; width: auto }` and `.sponsorMark { 48px→62px; width: auto }` | The width depends on the decoded image. The band height jumps at 640 px on rotation or resize. | **Reserved boxes:** `.mark` 88×34 → 109×42 at ≥640. `.sponsorMark` 82×48 → 106×62 at ≥640. Set both `width` and `height` in CSS (aspect 1600/619 and 1387/812). |
| R6 | `.footerInner { display:flex; flex-wrap: wrap; align-items: center }` plus `.footerDivider { align-self: stretch; min-height: 56px }` | The brand blocks center vertically on marks of different heights, so the two social rows sit at **different y** (uneven). At narrow or zoomed widths the sponsor block wraps and the divider is orphaned or changes height. | A grid with no wrap. Each brand is a two-row grid: a fixed `--mark-row` row, then socials (D2). The divider height is `--mark-row`. |
| R7 | `.socialLink` 24→44 via `@media (pointer: coarse)` only | Hybrid or emulated devices flip size, and a phone with a fine pointer gets 24 px. | Width-based: 44 px below 640 px, and 44 px on any coarse pointer. 32 px only at ≥640 px with a fine pointer (still ≥ `--tap-aa`). |
| R8 | `.footer { margin-top: var(--space-16) }` | A fixed 64 px always sits on top of each page's own bottom padding. | `margin-top: 0`. Spacing above the footer comes from `PageBody` padding-bottom (`--space-16`). |
| R9 | iOS rubber-band at the bottom shows the root background (white/paper) under the green band | A white flash or gap under the footer on overscroll. | Optional, low risk: `html:has([data-shell='site']) { background: var(--clay-700) }`. The header band is also green, so top and bottom overscroll both match. Content keeps paper-50 through its `.page` background. Admin and auth are unaffected. |
| R10 | Fonts use `display: 'swap'` | The new meta text could shift on swap. | It stays on one line with a fixed `line-height` token. Keep `next/font`'s default `adjustFontFallback`. |

### D2. Footer spec

**Structure** (one component, `SiteFooter`, rendered only by the site shell)
```
<footer class=footer>                       full-bleed band, child of the shell (never inside PageBody)
  <div class=inner>                          SAME container as page-header .inner/.body
    <div class=brands>                       grid: auto | 1px | auto, justify-content:start
      <div class=brand> [club mark link] <ul class=social>IG FB</ul> </div>
      <span class=divider aria-hidden>
      <div class=brand> [sponsor mark link] <ul class=social>IG FB</ul> </div>
    </div>
    <p class=meta>{footerMeta}</p>          rule above, left-aligned
```
- **Hierarchy:** brand (marks), then links (each brand's own accounts, directly under its mark), then meta (`Open Tennis, Mexicali, México`). There are no new links (scope). The social groups become `<ul>`, not `<nav>`. They're external accounts, not site navigation, and this removes two unlabeled `navigation` landmarks.
- **Container:** `max-width: 72rem; margin-inline: auto; padding-inline: var(--space-4)`, and `var(--space-8)` at ≥640. Reuse the page-header container class or values so the left edge of the marks equals the masthead and body edge at every width. Add `padding-inline: max(gutter, env(safe-area-inset-left/right))` for landscape notches.
- **Background:** `.footer` is a block child of the flex shell. Its width is the viewport width, with no `100vw`, no negative margins and no `overflow` tricks. Done means no gap at either edge at 320–1920 px and `scrollWidth == innerWidth`. The mockups verify this at 1440, 390 and 320.
- **Grid and spacing tokens**

| Property | <640 px | ≥640 px |
|---|---|---|
| Footer padding-block | `--space-8` top · `calc(--space-8 + env(safe-area-inset-bottom))` bottom | `--space-12` top · `calc(--space-12 + env(safe-area-inset-bottom))` bottom |
| `--mark-row` (brand row height; divider height) | 48px | 62px |
| Club mark box | 88×34 | 109×42 |
| Sponsor mark box | 82×48 | 106×62 |
| Column gap (brand · divider · brand) | `--space-6` | `--space-6` |
| Mark to socials | `--space-2` | `--space-2` |
| Social link box | `--tap-min` 44 | 32 (fine pointer) / 44 (coarse) |
| Gap between social links | `--space-1` | `--space-1` |
| Brands to meta rule | `--space-6` | `--space-6` |
| Meta | rule `1px rgb(255 255 255/.18)`, `padding-top: --space-4`, `--type-body-sm` 13/18 Instrument Sans 400, `rgb(255 255 255/.72)` | same |

- **Optical alignment:** the first social link gets `margin-inline-start: calc((20px - box) / 2)` (−12 px at 44, −6 px at 32). That puts the 20 px glyph flush with its mark's left edge. Its focus ring uses `outline-offset: -2px` so it isn't clipped at the 16 px gutter.
- **Mobile 320/375/390:** the brand row stays on **one line**. At 320 the total width is 92 + 24 + 1 + 24 + 92 = 233 px of the 288 px available, so it never wraps. The meta line stacks below. The safe-area padding keeps the meta line above the home indicator.
- **Divider:** `1px`, `height: var(--mark-row)`, `rgb(255 255 255/.3)`, decorative (`aria-hidden`).

**Focus order and visible focus:** Open Tennis home link, then OT Instagram, then OT Facebook, then the AF Pro Shop link, then AF Instagram, then AF Facebook. This is DOM order and matches the visual order. No `tabindex`. Focus uses `outline: 2px solid var(--paper-0)` on the band (9.6:1 against clay-700). The mark links get `outline-offset: 4px`, and the social links get `-2px`.

**Contrast** (computed from token hex; text needs AA 4.5:1, non-text 3:1)

| Pair | Ratio | Result |
|---|---|---|
| Social glyph / meta text `rgb(255 255 255/.72)` on `--clay-700` #3b4a21 (flattens to #c8ccc1) | **5.90:1** | AA text ✔ |
| `--paper-0` (hover glyph, focus ring) on `--clay-700` | **9.60:1** | ✔ |
| Divider `rgb(255 255 255/.3)` on `--clay-700` | 2.31:1 | Decorative, exempt |
| Auth meta / labels `--ink-500` on `--paper-50` / `--paper-0` | **5.28 / 5.78:1** | ✔ |
| Auth back link `--ink-900` on `--paper-50` | 16.38:1 | ✔ |
| "¿Olvidaste…" `--clay-600` on `--paper-0` | 8.26:1 | ✔ |
| Submit `--paper-0` on `--clay-500` | 6.51:1 | ✔ |
| Error `--fault-500` on `--paper-50` | 6.49:1 | ✔ |
| Focus ring `--clay-500` on `--paper-0` | 6.51:1 | ✔ (non-text) |
| ⚠ LanguageToggle inactive `--ink-300` on `--paper-0` | **2.50:1** | **Fails.** Needs a light tone for auth (D5) |
| ⚠ LanguageToggle inactive `--ink-300` on `--clay-700` (today's header) | 3.84:1 | Fails AA for 11 px text. Header is out of scope; flagged |

### D3. Not-found inside the site shell (no app code; arrangement only)
- Extract the shell markup from `app/(site)/layout.tsx` into one shared component (for example `components/site-shell.tsx`): `<div class=shell data-shell="site"><div class=content>{children}</div><SiteFooter/></div>`. `(site)/layout.tsx` renders `<SiteShell>{children}</SiteShell>`.
- `app/not-found.tsx` stays at the root, because only the root `not-found` catches unmatched URLs. It wraps its output in `<SiteShell>` and **deletes its own `<SiteFooter/>`** from inside `PageBody`.
- Why not `(site)/not-found.tsx` with a `[...missing]` catch-all: a catch-all in a route group can catch `/admin/<typo>` style URLs and is easy to break. The shared-component route has the same anchoring by construction, with no routing change.
- **Check:** exactly **one** `<footer>` in the DOM on `/no-existe` **and** on a `notFound()` thrown from `(site)` (for example `/t/<hidden-slug>`). Its bottom edge equals the viewport bottom at 1440×900 and 390×844.

### D4. Benchmark: auth pages (captured today, 1440 + 390, `bench/contact-*.png`)

| | GitHub | Google | Stripe | Vercel |
|---|---|---|---|---|
| Container | Narrow centered column, form in a light box | **Centered bordered card** (desktop); edge-to-edge on mobile | Centered white card on a decorative background | Centered column, no card |
| Logo | Centered, above the title | Inside the card, top | Top-left of the page, outside the card | Top-left mark |
| Header chrome left | None | None | Logo only | Logo + "Sign Up" |
| Site nav / footer | None / slim legal row (Terms, Privacy, Docs…) | None / **slim row: language select left, Help·Privacy·Terms right** | None / none | None / slim "Terms · Privacy" |
| Language switch | No | **Yes, in the slim row** | No | No |
| Contextual link | "New to GitHub? Create an account" under the form | "Create account" in the card | "New to Stripe? Create account" in a card footer | "Don't have an account? Sign Up" |

**Pick for OpenTennis: GitHub's centered logo above a Google-style card and slim bottom row.** All four drop site nav and the full footer, which settles Luis's point. Google is the only one that keeps a language switch, and it puts it in the slim bottom row. That's the slot we need, since ES/EN must keep working. GitHub's centered logo above the card gives a single home exit that doesn't read as navigation. A bordered card on paper-50 (not a shadow) follows the token rule that shadow is for modals only. It also reuses the existing login panel's 2 px clay-500 top rule, so the card isn't a new component. Stripe's decorative background and Vercel's top bar would bring chrome back.

### D5. Auth layout (addendum 10–14)

**Route arrangement (URLs unchanged):** move the pages under a route group with its own layout. There's no `app/admin/layout.tsx` today, so nothing is inherited.
```
app/admin/(auth)/layout.tsx            → <AuthShell> (reads currentLocale() itself)
app/admin/(auth)/login/…
app/admin/(auth)/forgot-password/…
app/admin/(auth)/reset-password/…      (page + invalid-page; submit/route.ts may move with it, URL is the same)
app/admin/(auth)/invite/accept/…       (+ invalid-page; accept-submit route unchanged)
```
`InvitePageShell` is replaced by an in-card heading pattern. It no longer renders `PageHeader`, `SiteNav` or `SiteFooter`. Middleware and redirect targets (`/admin/login`, `/admin`) don't change.

**Shell anatomy** (mockups `auth-login-*`)
```
<div class=auth data-shell="auth">              grid rows: 1fr auto; min-height:100vh; min-height:100svh; bg --paper-50
  <main id="main" tabIndex=-1 class=authMain>  skip-link target (missing on login today)
    <div class=stack>                          max-width 25rem (400px), centered, gap --space-6
      <a href="/" aria-label={homeLinkLabel}>  green mark, reserved box 109×42 (all widths), priority
      <section class=card> eyebrow? · <h1> · lead · status/error slot · form </section>
      <a class=back>{contextual link}</a>      centered, --type-body, ink-900, underline, min-height --tap-min
  <footer class=slim>                          border-top 1px --line-100; padding-block --space-3 + safe-area
    <div class=container>  [LanguageToggle tone="light"] ……… {footerMeta}   (space-between, body-sm, ink-500)
```
- **Card:** `background --paper-0; border 1px --line-200; border-top 2px --clay-500; radius --radius-data; padding --space-8`, and `--space-6` below 640. No shadow. Width 100% of the stack, max 25rem (400 px).
- **Vertical position:** at ≥640 the stack is centered in the `1fr` row (`align-content: center`, padding-block `--space-12`). Below 640 it's **top-aligned** (`padding: --space-8 --space-4 --space-12`), so the card doesn't jump when the soft keyboard opens. That's criterion 13's no-jitter rule.
- **390 / 320:** the card fills the width inside 16 px gutters (358 / 288 px), and the border stays. Inputs are `width: 100%; min-width: 0`; without it the mockup overflowed by 9 px at 320. The slim row stays on one line at 320: toggle 89 px plus meta about 180 px.
- **Slim line:** the same 72rem container and gutters as the site. It sticks to the bottom through the grid `1fr`, not `position: fixed`. It never overlaps the card: on a short viewport, the content row grows and the page scrolls.
- **LanguageToggle `tone="light"`** (new prop, same form and server action): inactive `--ink-500` (5.78:1), hover `--ink-900` (today's hover goes to `--paper-0`, which is invisible on white), active `--clay-500` fill with white. Border `--line-200`. Boxes are 44×32 with a fine pointer and 44×44 below 640 or with a coarse pointer. Wrap the form in `role="group" aria-label={languageLabel}`. Switching keeps the current URL and query, so `?token=` and `?error=` survive, as it does today with `revalidatePath`.
- **Focus order:** logo, then the form fields in order, then the in-card links, then submit, then the back link, then the language toggle. Visible focus uses the existing `2px --clay-500` rules.
- **Status and error slots don't change:** errors stay `<p role="alert">` (login, reset, invite). Forgot-password success stays `<div role="status" tabIndex={-1}>`, focused on arrival. Successful reset and invite accept still redirect to `/admin`, which keeps its normal admin header.

**Per page**

| Page / state | Eyebrow | `<h1>` (in card) | Card body | Link below card |
|---|---|---|---|---|
| Login | `adminEyebrow` "Admin" | `signIn` "Iniciar sesión" (replaces the text "Open Tennis" + h1 "Admin"; the logo carries the brand) | email, password, `forgotPasswordLink`, submit `signIn`, `role=alert` error | `notFoundHome` "Ir al inicio" |
| Forgot: form | — | `forgotPasswordTitle` | `forgotPasswordLead`, email, `sendResetLink` | `backToSignIn` |
| Forgot: sent | — | `forgotPasswordTitle` | `role=status`: `resetLinkSent`. The in-status `backToSignIn` link is **removed** and the one below the card is kept (one contextual link) | `backToSignIn` |
| Reset: valid | — | `resetPasswordTitle` | lead, locked email, form, `role=alert` | `backToSignIn` |
| Reset: invalid token | — | `resetLinkInvalidTitle` | `resetLinkInvalidBody`, then `requestNewLink` as the in-card action (link styled as `.homeLink`). The `notFoundHome` line is dropped (the logo goes home) | `backToSignIn` |
| Invite: valid | — | `acceptInviteTitle` | lead, locked email + `inviteEmailLocked`, form, `role=alert` (`acceptInviteFailed` / field errors) | `backToSignIn` (for people who already have an account) |
| Invite: invalid | — | `inviteLinkInvalid` | `inviteLinkInvalidBody` | `notFoundHome` "Ir al inicio" |

Document titles don't change.

### D6. Dictionary keys (plain strings; `fill()` placeholders)

**Reused (no change):** `signIn`, `adminEyebrow`, `email`, `password`, `forgotPasswordLink`, `forgotPasswordTitle`, `forgotPasswordLead`, `sendResetLink`, `resetLinkSent`, `backToSignIn` ("Volver a iniciar sesión" / "Back to sign in"), `notFoundHome` ("Ir al inicio" / "Go to the home page"), `resetPasswordTitle`, `resetPasswordLead`, `resetLinkInvalidTitle`, `resetLinkInvalidBody`, `requestNewLink`, `acceptInviteTitle`, `acceptInviteLead`, `inviteEmailLocked`, `inviteLinkInvalid`, `inviteLinkInvalidBody`, `localeName`.

**New**

| Key | es-MX | en | Replaces |
|---|---|---|---|
| `footerMeta` | Open Tennis, Mexicali, México | Open Tennis, Mexicali, Mexico | New meta line (site footer + auth slim line). Same value as `resetEmailFooter`/`inviteEmailFooter`; the email keys may point at it |
| `homeLinkLabel` | Open Tennis — inicio | Open Tennis — home | Hardcoded `aria-label` on the footer home link (ES only) **and** the header home link (EN only), plus the auth logo link |
| `sponsorLinkLabel` | Patrocinador oficial: AF Pro Shop | Official sponsor: AF Pro Shop | Hardcoded `aria-label` on the sponsor link (header + footer) |
| `socialInstagram` | {name} en Instagram | {name} on Instagram | `CLUB_SOCIAL`/`PRO_SHOP_SOCIAL` labels (`{name}` = "Open Tennis" / "AF Pro Shop", brand names not translated) |
| `socialFacebook` | {name} en Facebook | {name} on Facebook | same |
| `languageLabel` | Idioma | Language | `aria-label` for the toggle group |
| `skipToContent` | Saltar al contenido | Skip to content | Hardcoded skip link in `app/layout.tsx` (criterion 6) |

The image alt texts "Open Tennis" and "AF Pro Shop — Encordados Profesionales" are the logos' own words, so they're the same in both languages. They stay literal.

### D7. QA checks for Design PASS (AFTER set = BEFORE set)
1. 1440×900 and 390×844 on `/no-existe` and `/search?q=zzzz`: the footer's bottom equals the viewport bottom, there's one `<footer>`, and there's no scroll.
2. Home, a tournament page and a blog article: the footer follows the content, and the marks' left edge equals the masthead's left edge (±0 px).
3. Widths 320, 375, 390, 768, 1024, 1440 and 1920: `scrollWidth === innerWidth`, and the band reaches both edges.
4. CLS from the footer is 0 on load and on scroll, including a throttled 3G load. On iOS Safari, scrolling a short page up and down leaves the footer still.
5. Social boxes are 44×44 at ≤639 px. Tab order matches D2, and focus is visible.
6. EN: all aria-labels change language (axe / accessibility tree), and nothing wraps differently.
7. Auth (login, forgot form/sent, reset valid/invalid, invite valid/invalid) at 1440/390/320: no header nav, no site footer, one link below the card, the slim row at the bottom, and ES↔EN keeps the URL and query.
8. Regression: public header unchanged, and admin header unchanged with **no footer**.

### D8. Criterion 15 — header language toggle contrast (Lead decision, 2026-11-12)
15. In `components/language-toggle.module.css`, the header (green band) toggle's inactive `.option` color changes from `var(--ink-300)` (#a3a68e, 3.84:1 on `--clay-700` #3b4a21) to `var(--line-200)` (#d8dac9, **6.76:1**). Nothing else changes: the hover stays `--paper-0`, the active state stays white on `--clay-500` (6.51:1), and the layout, markup and sizes are untouched. The auth pages use the light variant from D5 (inactive `--ink-500`, 5.78:1 on white), so this token change must apply to the header context only.
QA check: computed inactive color on the header is rgb(216, 218, 201), the contrast on the band is ≥ 4.5:1, and the header is otherwise pixel-identical to BEFORE.
