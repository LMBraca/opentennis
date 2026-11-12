# OpenTennis

Tournament management for Open Tennis, a club in Mexicali, Baja California,
Mexico. pnpm monorepo: `apps/web` (Next.js 15 App Router), `packages/engine` (pure draw
logic, no I/O), `packages/db` (Neon Postgres + Drizzle).

## Commands

```bash
pnpm -r test          # 727 tests
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

**Demo data for screenshots** — a tournament mid-event, with generated draws,
entered scores, advanced winners, one live match, courts and three illustrated
updates:

```sh
node scripts/make-demo-images.mjs   # once; writes apps/web/public/demo/*.png
cd packages/db && set -a && . ../../.env.local && set +a && npx tsx src/seed-demo.ts
```

It refuses to run against the `production` endpoint and rebuilds its own
tournament (`copa-aniversario-open-tennis-26`) and updates by slug on every
run, so it is safe to repeat. It never touches Copa Otoño, Invierno, or a
player it did not create — players are matched on email and reused. The images
are local files because `next.config.ts` sets `remotePatterns: []`; a remote
placeholder URL will not render.

Quote the values in `.env.local`. Neon connection strings contain `&`, and
unquoted they break `. ./.env.local` with a shell parse error — which then
breaks the migrate command above.

### Recovering data — the window is shorter than a tournament

**Point-in-time restore reaches back six hours.**
`history_retention_seconds` on this project is `21600`, verified 2026-11-08.
A tournament day is longer than that. A result destroyed in the morning and
noticed that evening is **not recoverable** — and the `production` branch is
not protected (`protected: false`), so nothing stops a delete either.

So do not rely on PITR during an event. Take a **snapshot branch** instead: it
is copy-on-write, takes about a second, costs almost nothing, and — unlike the
6-hour window — it keeps existing until you delete it.

```sh
# Before entries close, and again every couple of hours on tournament day.
neon branches create --project-id noisy-firefly-85507616 \
  --parent production --name snap-$(date +%m%d-%H%M)

neon branches list --project-id noisy-firefly-85507616
```

To read a snapshot, get its connection string and point a psql at it —
**never** repoint the app:

```sh
neon connection-string snap-1115-0900 --project-id noisy-firefly-85507616
```

Recovery is then a copy forward: read the correct rows out of the snapshot and
write them back through the admin UI or a targeted SQL update. Do not promote a
snapshot to default or swap branch names mid-event; the app's env points at
compute endpoints, and scores entered since the snapshot would vanish.

Two things worth doing before the first real tournament: turn on branch
protection for `production`, and check whether the plan can raise retention
past six hours.

New branch: `neon branches create --project-id noisy-firefly-85507616 --name x`,
then `neon connection-string x --project-id ... [--pooled]`.

**Never run `pnpm build` while a dev server is up.** `next dev` and
`next build` share `apps/web/.next`, so a production build replaces the
chunks the dev server is still serving and the whole site loses its CSS —
a 400 on a hash that no longer exists, which reads as a styling bug. Build
elsewhere instead:
`NEXT_DIST_DIR=.next-verify pnpm build && NEXT_DIST_DIR=.next-verify pnpm start -p 3111`.
Recovery is `rm -rf .next && pnpm dev`.

**That verify build rewrites `apps/web/next-env.d.ts`**, flipping its
`reference path` from `./.next/types/routes.d.ts` to `.next-verify`. The file
is tracked and says "should not be edited", so it shows up as a real diff.
Revert it (`git checkout apps/web/next-env.d.ts`) and delete `.next-verify`
when you are done — committing that line breaks `pnpm typecheck` for everyone
else the moment the directory is gone.

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
- **A draw can have TWO stages.** A consolation draw is a second stage
  with `parentStageId` set. Anything loading a draw must not `limit(1)` on
  stages, and `persistDraw` needs the main stage's `matchIdByEngineId`
  passed as `externalMatchIds` or every `loserOf` feed resolves to null.
- **Clearing a result is refused when a later match is already decided.**
  Emptying a slot does not empty the result that sits in it, so a final
  would stand as won against an empty line. Same stance as `redrawEvent`.
- **Scoring format resolves round → event.** The six columns on `events` set
  the draw's format; `rounds.scoring_override` (jsonb) overrides one round,
  which is how "the final is best of 3" works. Always go through
  `resolveScoringFormat` so the form and the validator agree — a form showing
  three set rows while the server validates two is the bug it prevents.
- **A page can hold more than one bracket.** A draw with a consolation
  renders two, and anything that reaches for "the bracket" with a bare
  `document.querySelector('[data-bracket-canvas]')` gets the FIRST one.
  `BracketZoom` did, so the consolation's controller resized the main
  draw's canvas to the consolation's height and `overflow: hidden` ate half
  the quarterfinals. It did it while rendering nothing itself — an effect
  still runs in a component that returns `null`. Both hooks now carry a
  scope value (the first match's id); pass it, do not reintroduce a bare
  attribute selector.
- **Consolation round names are prefixed on purpose.** The engine names
  them "Consolation semifinal", not "Semifinal", because six surfaces
  render `rounds.name` raw and several list both brackets in one flat list
  — the scores queue, the order of play, the scorekeeper page, the CSV
  export. A bare "Semifinal" there is a result entered against the wrong
  match. Strip the prefix for display only where the bracket is already
  named, with `withoutConsolationPrefix`.
- **An event with a consolation has TWO stages.** Queries keyed on
  `stages.eventId` now return both, and both number their rounds from zero.
  Anything selecting `roundIndex = 0` must exclude `kind = 'consolation'`
  (the slot-swap list offered consolation slots fed by unplayed matches),
  and anything ordering by `roundIndex` must order by stage first or the
  two interleave.
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
