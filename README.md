# Inventory

Internal inventory, shipment, and sales tracking app for a two-person
bulk-import business. Not a public product — built for exactly two
users (the owners).

## Planning docs

Read these before making product or schema decisions — they're the
source of truth for scope and rationale, not this README:

- [`vision.md`](./vision.md) — original requirements
- [`planning-decisions.md`](./planning-decisions.md) — resolved product/business-rule decisions
- [`design.md`](./design.md) — UI/UX and screen-level design
- [`roadmap.md`](./roadmap.md) — phased build plan and sign-off checklists
- [`docs/backup-restore.md`](./docs/backup-restore.md) — disaster-recovery backup/restore procedure

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript, Turbopack) — note: this major version has breaking changes from older Next.js conventions; see `AGENTS.md` before writing app code
- [Tailwind CSS v4](https://tailwindcss.com)
- [Prisma 7](https://www.prisma.io) with the `@prisma/adapter-pg` driver adapter, targeting Postgres
- [Railway](https://railway.app) for hosting (app + Postgres)

## Local development

### Prerequisites

- Node.js 20.9+ (developed against v24)
- Access to the project's Railway Postgres instance (or a local Postgres instance)
- [Railway CLI](https://docs.railway.app/guides/cli) if you need to pull the shared database URL: `railway login`, then `railway variables --service Postgres`

### Setup

```bash
npm install

# Create .env with a DATABASE_URL pointing at Postgres.
# For the shared dev database, use the DATABASE_PUBLIC_URL value from
# `railway variables --service Postgres` (the private railway.internal
# URL only resolves inside Railway's network).
cp .env.example .env   # if present, otherwise create manually — see prisma/schema.prisma

npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database workflow

The Prisma client is generated into `src/generated/prisma` (gitignored,
regenerate with `npx prisma generate` after pulling schema changes).

```bash
npx prisma generate     # regenerate client after a schema change
npx prisma db push      # push schema changes to the database (no migration history)
```

Schema lives in `prisma/schema.prisma`; connection config is in
`prisma.config.ts`.

### Other scripts

```bash
npm run build   # production build
npm run lint    # eslint
```

## Repo structure

```
src/
  app/                route segments (App Router); each top-level nav
                       section has its own page.tsx
  components/
    nav/               responsive nav shell (desktop sidebar / mobile
                       bottom nav)
  lib/                 shared utilities (nav config, Prisma client)
  generated/prisma/    generated Prisma client (gitignored)
prisma/
  schema.prisma        data model
```

## Deployment

Hosted on Railway. The `production` environment deploys from `main`.
