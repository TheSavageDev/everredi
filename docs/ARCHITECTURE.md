# Architecture

## Monorepo

pnpm workspaces + Turborepo. Shared contracts live in `packages/*`; UI shells stay per app.

```
apps/api  → Rust (Axum, Tokio, sqlx) + Supabase (Auth JWT verify, Postgres)
apps/web  → Next.js App Router + Tailwind + Zustand + TanStack Query
apps/mobile → Expo Router + Zustand + TanStack Query
packages/types | validation | api-client | config
```

## Deploy target

Next.js stays on Vercel. The API is the Rust service in `apps/api/Dockerfile` (Cloud Run is the container fallback already named for that image). Browser `/api/*` is rewritten by Next to `API_INTERNAL_URL`. See [`docs/VERCEL.md`](./VERCEL.md).

## Auth

1. Client signs in with Supabase Auth (email/password, Google, or Apple)
2. Web OAuth: `/auth/callback` exchanges the PKCE code, then `/auth/complete` bootstraps the workspace
3. Sends `Authorization: Bearer <access_token>` to the Rust API
4. Public legal: `/terms`, `/privacy`, `/eula`, `/disclaimer` (see [AUTH.md](./AUTH.md))
3. The API verifies the JWT (JWKS / JWT secret) and upserts `users`
4. Personal workspace is created on first login

## Data ownership

Everything operational is **workspace-scoped** (`workspace_id`): kits, inventory, locations. Members belong to workspaces via `workspace_members`. Kit ACL is an optional narrower override. No parallel `teams` table.

## Billing

RevenueCat is the only app checkout path. The Rust API trusts **RevenueCat webhooks** only to update entitlement fields, and it rejects the webhook when `REVENUECAT_WEBHOOK_SECRET` is unset. Cancellation does not clear Pro before expiration. Stripe may exist behind RC for web billing but is not dual-written from the API.

## Client contract

`@everredi/api-client` takes `getAccessToken()` so the web app keeps one typed fetch surface. Zod schemas in `@everredi/validation` stay on the client. The Rust service validates its own JSON.
