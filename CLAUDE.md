# OpenTennis

Tournament management for Open Tennis, a club in Tijuana, Mexico. pnpm
monorepo: `apps/web` (Next.js 15 App Router), `packages/engine` (pure draw
logic, no I/O), `packages/db` (Neon Postgres + Drizzle).

## Commands

```bash
pnpm -r test          # 623 tests
pnpm lint
cd apps/web && pnpm build
cd packages/db && set -a && . ../../.env.local && set +a && pnpm generate && pnpm migrate
```

Migrations use `DATABASE_URL_UNPOOLED`. Never the pooled URL — PgBouncer's
transaction mode drops the session state they rely on, and the failure does
not mention pooling.

## Databases

Neon project `opentennis` (`noisy-firefly-85507616`), **two branches**:

| Branch | Compute | Used by |
|---|---|---|
| `production` | `ep-rapid-dawn-akcv4lkp` | Vercel **production** only |
| `development` | `ep-old-meadow-aksdequf` | `.env.local` and Vercel **preview** |

Local development must NEVER point at `production` — it did until 2026-11-06,
which is why a session of ordinary testing wrote scores and merged players in
the live database. Check with `echo $NEON_BRANCH` or `/api/health/db`, which
reports the branch it is talking to.

Production carries the organization, the admin user and the six-category
ladder, and nothing else. `development` keeps seeded players and a draft
tournament to work against.

Quote the values in `.env.local`. Neon connection strings contain `&`, and
unquoted they break `. ./.env.local` with a shell parse error — which then
breaks the migrate command above.

New branch: `neon branches create --project-id noisy-firefly-85507616 --name x`,
then `neon connection-string x --project-id ... [--pooled]`.

**Never run `pnpm build` while a dev server is up.** `next dev` and
`next build` share `apps/web/.next`, so a production build replaces the
chunks the dev server is still serving and the whole site loses its CSS —
a 400 on a hash that no longer exists, which reads as a styling bug. Build
elsewhere instead:
`NEXT_DIST_DIR=.next-verify pnpm build && NEXT_DIST_DIR=.next-verify pnpm start -p 3111`.
Recovery is `rm -rf .next && pnpm dev`.

**`pkill -f "next start"` does not work.** Next renames the process to
`next-server`, so the old server survives, the new one fails to bind :3000,
and you end up testing the previous build. Use `pkill -f next-server`.

## Deploys

Live at **https://www.opentennis.mx** (apex 308s to www). Vercel project
`opentennis` under the **lmbracas-projects** scope — not avant-leap, this
is the club's own project.

**Root Directory is `apps/web`**, set through the API because the CLI has no
command for it. That is the whole trick for this monorepo: Vercel detects
the framework from the package.json it finds in the root directory, and the
repo root has no `next` dependency. pnpm workspace links still resolve
because Vercel installs from the workspace root when it sees
`pnpm-workspace.yaml`.

There is deliberately **no `vercel.json`**. It described a repo-root deploy
(`buildCommand: pnpm --filter …`, `outputDirectory: apps/web/.next`) and
every one of those paths became wrong once the root directory moved. Build
settings live in the project; Next.js is auto-detected.

Required env (production + preview): `DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, `OPENTENNIS_ORG_ID`. Without the org id every page
throws — see `lib/db.ts`.

Optional: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (ENT-3).
With neither set the entry form works exactly as before and no challenge is
shown — `lib/turnstile.ts` fails open on purpose, including when Cloudflare
is unreachable, because a spam gate that takes the entry form down with it
is worse than the spam. Set BOTH or neither; one alone is treated as unset.

**QR codes bake in the host they were generated on.** `/admin/:slug/qr`
builds absolute URLs from the request headers, so generate them on
www.opentennis.mx — a sheet printed from localhost points at localhost
forever. Changing the canonical host later does not break printed codes,
because the apex redirect keeps resolving them.

## Design — read before touching any CSS

Full system in `docs/design-system.md`. Run `/design-review` (or
`node .claude/skills/design-review/audit.mjs`) before shipping UI. The
official `frontend-design` plugin is installed — load it when reshaping UI.

The point of these rules is that this site must not look AI-generated. Each
one has already been violated at least once here.

- **No uppercase anywhere.** The home page once rendered 49% of its visible
  text in caps and admin 86%. Anthropic's `frontend-design` skill lists
  all-caps labels as template chrome. Drop `--type-label-tracking` too.
- **No arrows pasted onto link text** ("All updates →") and **no `' · '`
  joined meta strings** — both named as template chrome.
- **No coloured 3–4px stripe on a card edge.** The most reliable tell there
  is. If a card needs a stripe to read as important, fix the hierarchy.
  Blockquotes are exempt.
- **Optic yellow (`--optic-500`) means "live right now".** Never decorative.
- **Two radii in the product**: `--radius-data` (2px), `--radius-pill`.
- **One shadow token**, for modals. Depth is line weight and surface tint.
- **Warm neutrals.** Cool grey beside the brand olive reads cheap.
- **No gradients, glassmorphism, tinted shadows, purple, or emoji icons.**
- **Light only.** The dark theme was removed deliberately.
- **One masthead: `components/page-header.tsx`.** Every page uses
  `PageHeader` + `PageBody`; nothing else builds a header. There were twelve
  before, and half the product had no logo. Pages choose `variant`
  (`page` | `tool`) and `width`, never a gutter or a title size.
- **Check undefined tokens.** `var(--space-5)` does not exist; CSS silently
  drops the entire declaration, and a button shipped with no horizontal
  padding. The audit catches this.
- **Never put a `<header>` inside a printable component.** The print rules in
  `globals.css` hide `body header`/`nav`/`footer` with `!important` to drop
  the masthead (DES-10). That selector also catches a `<header>` nested
  anywhere else, so the draw sheet's own title block vanished — on paper
  only, invisible on screen. Use a `div`; the `h2` carries the semantics.

## Language

**`es` is the DEFAULT locale** — a first visit with no cookie, and every QR
code scanned off a poster, lands in Spanish. English is the translation.

Spanish is first-class and **Mexican**, not peninsular. "Cancha" not "pista",
ustedes not vosotros, `es-MX` not `es-ES`. Keep "Singles" as "Singles" —
clubs here say it. A draw is a "categoría".

## Things that bite

- **`updated_at` never updates.** `timestamps()` gives it `defaultNow()` with
  no `$onUpdate` and there is no trigger, so across every table it is a
  CREATION time. Anything built on "what changed since" must key off
  append-only data instead — the live stream uses `score_events`, which gets
  exactly one row per scoring path including `clearResult`. A version keyed
  on `matches.updated_at` connects, heartbeats and never fires once.
- **Generating a draw is a one-way door.** `generateDraws` refuses while
  `entriesOpen`, and skips any event that already has matches rather than
  overwriting it — it used to call `clearDraw()` unconditionally, so a second
  click destroyed the bracket and every result under it. Replacing a draw is
  `redrawEvent`: typed confirmation, and it refuses once any match has a
  winner. Enforce it in the ACTION, not just by hiding the button.
- **The scheduling engine is timezone-free on purpose** — it lays slots out
  as minutes from midnight and uses `getUTCDay()`, so it returns a WALL CLOCK
  in UTC fields. `lib/venue-time.ts` is the one boundary that turns that into
  a real instant (`VENUE_TIME_ZONE`, an IANA zone so DST is handled; a fixed
  -8 is an hour wrong all summer). Write via `wallClockToInstant`, read with
  `venueDateFormatter`/`venueTimeFormatter`. Storing the engine's value raw
  made a 10:00 court window land at 02:00.
- **The scheduler must persist `courtId`.** The engine assigns every match a
  `courtIndex` — it has to, or two matches share a court — and that used to
  be discarded: only `scheduledAt` was written and the `courts` table was
  never populated, so nobody could tell which court to walk to. Court rows
  are created on demand as "Cancha 1..N".
- **Scoring format resolves round → event.** The six columns on `events` set
  the draw's format; `rounds.scoring_override` (jsonb) overrides one round,
  which is how "the final is best of 3" works. Always go through
  `resolveScoringFormat` so the form and the validator agree — a form showing
  three set rows while the server validates two is the bug it prevents.
- `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` are on. Optional
  props that may receive `undefined` must declare `| undefined`.
- Functions cannot cross the server→client boundary. `npm run build` does NOT
  catch it; RSC serialization fails at request time. Use template strings.
- Dates are plain calendar dates stored as text. Always format with
  `timeZone: 'UTC'` or they shift a day west of Greenwich.
- Tournament slugs are globally unique and `/t/:slug` is printed on QR codes.
  That route must keep resolving forever (PRD §4.4) — it redirects to the
  first draw rather than 404ing.
- Public queries filter out drafts; admin pages must use the admin query or
  an organizer loses their own unpublished work.
