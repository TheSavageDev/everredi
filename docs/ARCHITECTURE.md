# Architecture

## Monorepo

pnpm workspaces + Turborepo. Shared contracts live in `packages/*`; UI shells stay per app.

```
apps/api  → NestJS + Drizzle + Supabase (Auth JWT verify, Postgres)
apps/web  → Next.js App Router + Tailwind + Zustand + TanStack Query
apps/mobile → Expo Router + Zustand + TanStack Query
packages/types | validation | api-client | config
```

## Deploy target

Prefer **one Vercel project with Services** (`web` + `api`) — see [`docs/VERCEL.md`](./VERCEL.md). Public routing: `/` → Next, `/api/*` → Nest. Dockerfiles remain as a self-host / Cloud Run fallback.

## Auth

1. Client signs in with Supabase Auth
2. Sends `Authorization: Bearer <access_token>` to Nest
3. Nest verifies JWT (JWKS / JWT secret) and upserts `users`
4. Personal workspace is created on first login

## Data ownership

Everything operational is **workspace-scoped** (`workspace_id`): kits, inventory, locations. Members belong to workspaces via `workspace_members`. Kit ACL is an optional narrower override. No parallel `teams` table.

## Billing

RevenueCat is the only app checkout path. Nest trusts **RevenueCat webhooks** only to update entitlement fields. Stripe may exist behind RC for web billing but is not dual-written from the API.

## Client contract

`@everredi/api-client` takes `getAccessToken()` so web and mobile share one typed fetch surface. Zod schemas in `@everredi/validation` are used by Nest pipes and client forms.
