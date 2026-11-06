# OpenTennis

Tournament management for Open Tennis, a club in Tijuana, Mexico. pnpm
monorepo: `apps/web` (Next.js 15 App Router), `packages/engine` (pure draw
logic, no I/O), `packages/db` (Neon Postgres + Drizzle).

## Commands

```bash
pnpm -r test          # 487 tests
pnpm lint
cd apps/web && pnpm build
cd packages/db && set -a && . ../../.env.local && set +a && pnpm generate && pnpm migrate
```

Migrations use `DATABASE_URL_UNPOOLED`. Never the pooled URL — PgBouncer's
transaction mode drops the session state they rely on, and the failure does
not mention pooling.

**`pkill -f "next start"` does not work.** Next renames the process to
`next-server`, so the old server survives, the new one fails to bind :3000,
and you end up testing the previous build. Use `pkill -f next-server`.

## Deploys

Vercel project `opentennis` under the **lmbracas-projects** scope (not
avant-leap — this is the club's own project).

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

## Language

Spanish is first-class and **Mexican**, not peninsular. "Cancha" not "pista",
ustedes not vosotros, `es-MX` not `es-ES`. Keep "Singles" as "Singles" —
clubs here say it. A draw is a "categoría".

## Things that bite

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
