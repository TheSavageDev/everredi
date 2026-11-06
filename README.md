# EverRedi

Greenfield monorepo for EverRedi — kit and inventory tracking with multi-member workspaces.

## Apps

- `apps/api` — Rust API (Axum, Tokio, sqlx, Supabase Auth/Postgres) on port 5051
- `apps/web` — Next.js App Router (marketing + app). Proxies `/api` to the Rust service.
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

# Apply the SQL schema to your Supabase project (or local Postgres):
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
pnpm dev
```

- API: `http://localhost:5051/api`
- Web: `http://localhost:3000`
- Mobile: Expo (`pnpm --filter @everredi/mobile start`)

## Docs

See [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/VERCEL.md`](docs/VERCEL.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and [`docs/BACKLOG.md`](docs/BACKLOG.md).

## Deploy

Web stays on Vercel. The Rust API is a container (`apps/api/Dockerfile`); set `API_INTERNAL_URL` to that origin so Next can proxy `/api` and the daily alerts cron can call it. See [`docs/VERCEL.md`](docs/VERCEL.md).
