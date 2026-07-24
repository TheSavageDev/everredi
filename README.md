# EverRedi

Greenfield monorepo for EverRedi — kit and inventory tracking with multi-member workspaces.

## Apps

- `apps/api` — NestJS API (Drizzle + Supabase Auth/Postgres)
- `apps/web` — Next.js App Router (marketing + app)
- `apps/mobile` — Expo Router (iOS/Android)

## Packages

- `@everredi/types` — shared domain types
- `@everredi/validation` — Zod schemas shared by API and clients
- `@everredi/api-client` — typed fetch client (`getAccessToken` injection)
- `@everredi/config` — shared tsconfig presets

## Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# Apply SQL migrations to your Supabase project, then:
pnpm --filter @everredi/api db:migrate
pnpm dev
```

- API: `http://localhost:5051/api`
- Web: `http://localhost:3000`
- Mobile: Expo (`pnpm --filter @everredi/mobile start`)

## Docs

See [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/VERCEL.md`](docs/VERCEL.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and [`docs/BACKLOG.md`](docs/BACKLOG.md).

## Deploy

Preferred: one Vercel project with **Services** (`apps/web` + `apps/api`). See [`docs/VERCEL.md`](docs/VERCEL.md) and root `vercel.json` for Cron, Queues, Workflow, Edge Config, Blob, BotID, and dashboard setup.
