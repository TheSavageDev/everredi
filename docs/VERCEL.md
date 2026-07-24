# Vercel platform plan (EverRedi)

Research against current Vercel docs (Services public beta, June 2026) and this monorepo.

## Spike in this PR

Root [`vercel.json`](../vercel.json) defines two **Vercel Services** in one project:

| Service | Root | Public route |
|---------|------|----------------|
| `web` | `apps/web` | `/(.*)` |
| `api` | `apps/api` (NestJS) | `/api/(.*)` |

- Nest keeps `globalPrefix('api')`, so `/api/health` reaches the API without path stripping.
- `web` binds to `api` as `API_INTERNAL_URL` for server-side calls (no public egress).
- Browser / mobile use the public same-origin (or deployment) `/api` surface.
- Dockerfiles remain for optional self-host / Cloud Run fallback.

### How to try it

1. Enable **Services** on the Vercel team/project (feature permission may be required).
2. `vercel link` from the repo root (project framework / Services mode).
3. Set env for both services: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, RevenueCat secrets.
4. Leave `NEXT_PUBLIC_API_URL` unset in production so web defaults to `/api`.
5. Point mobile `EXPO_PUBLIC_API_URL` at `https://<deployment>/api`.
6. `vercel deploy` (or Git integration). Use `vercel dev` / `vercel dev -L` for local multi-service.

### Path / CORS notes

- Same-origin web → API avoids most CORS issues.
- When `VERCEL=1`, Nest also allows `*.vercel.app` origins for preview tooling and mobile webviews.
- Local split-process: keep `NEXT_PUBLIC_API_URL=http://localhost:5051/api` and `CORS_ORIGIN=http://localhost:3000`.

---

## High-value features we are not using yet

Prioritized for EverRedi soft launch.

### P0 — do soon

| Feature | Why it helps | Action |
|---------|--------------|--------|
| **[Vercel Services](https://vercel.com/docs/services)** | Atomic web+API deploys, shared previews, internal bindings | Spike config in this PR; replace Cloud Run split on checklist |
| **[Deployment Protection](https://vercel.com/docs/deployment-protection)** + automation bypass | Lock previews; let Playwright hit them via `x-vercel-protection-bypass` | Enable Vercel Auth on previews; wire bypass into `apps/web` Playwright config |
| **[Cron Jobs](https://vercel.com/docs/cron-jobs)** | Daily expiration / low-stock notification fan-out without Cloud Tasks | Add secured Nest `POST /api/internal/cron/alerts` + `crons` in `vercel.json` |
| **Security headers** (started) | Baseline XSS/clickjacking posture | Expand with CSP once marketing + app URLs stabilize |
| **Fluid compute** (default on Nest) | Active CPU pricing for webhook/idle-heavy API | Confirm on project; no code change |

### P1 — soft launch polish

| Feature | Why it helps | Action |
|---------|--------------|--------|
| **[Web Analytics](https://vercel.com/docs/analytics)** + **[Speed Insights](https://vercel.com/docs/speed-insights)** | Marketing funnel + Core Web Vitals with almost no infra | Add `@vercel/analytics` / `@vercel/speed-insights` to `apps/web` layout |
| **[Vercel Firewall](https://vercel.com/docs/vercel-firewall)** managed rules | OWASP / bot / AI-scraper baseline in front of Nest webhooks + auth | Enable managed ruleset; allowlist RevenueCat webhook path if needed |
| **[BotID](https://vercel.com/docs/botid)** | Protect signup / invite accept from automated abuse | Protect `POST` auth-ish routes from web |
| **Skew Protection** | Avoid version skew between web assets and Nest during rolling deploys | Enable in project settings (Next supports it) |
| **Observability / Log Drains** | One place for Nest + Next logs; optional drain to Axiom/etc. | Turn on; keep Sentry for app errors (cursor rule already expects it) |
| **Playwright against previews** | Checklist item “Playwright smoke green against staging” | CI job on `deployment_status` + bypass secret |

### P2 — later / as needs appear

| Feature | Why it helps | Action |
|---------|--------------|--------|
| **[Queues](https://vercel.com/docs/queues)** | Offload fan-out notifications, email, RC post-processing | After Cron MVP; consider for invite email |
| **[Workflow](https://vercel.com/docs/workflow)** | Durable multi-step (invite → reminder → expire) | Only if Cron+Queues are insufficient |
| **[Vercel Blob](https://vercel.com/docs/vercel-blob)** | Kit photos / receipt uploads later | Not in v1 backlog; use when media lands |
| **[Edge Config](https://vercel.com/docs/edge-config)** | Feature flags / kill switches without redeploy | Optional for Pro limits or maintenance mode |
| **[Connect](https://vercel.com/docs/connect)** / OIDC | Short-lived creds to Marketplace DBs & third parties | Nice if we move secrets off long-lived env keys |
| **Marketplace Supabase** | Credential injection from dashboard | Optional; current project `jszxqowkkyjmplbzbgvf` already works via env |
| **Secure Compute / static IPs** | Private path to Postgres if we leave Supabase pooler public | Only if compliance requires it |
| **Sandbox** | Isolated agent/code execution | Not relevant until AI/RediBot (explicitly post-v1) |

---

## Explicit non-goals (for now)

- Dual Stripe checkout in app (backlog)
- Replacing Supabase Auth with another IdP
- Moving mobile hosting onto Vercel (Expo/EAS stays)
- Dropping Dockerfiles until Services is proven in production

---

## Env matrix (Services)

| Variable | Service | Notes |
|----------|---------|--------|
| `DATABASE_URL` | api | Supabase Postgres |
| `SUPABASE_URL` / `SUPABASE_JWT_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` | api | JWT verify + admin |
| `REVENUECAT_*` | api | Webhook + entitlement id |
| `CORS_ORIGIN` | api | Optional when same-origin; set for mobile web if needed |
| `NEXT_PUBLIC_SUPABASE_*` | web | Browser auth |
| `NEXT_PUBLIC_API_URL` | web | Leave unset on Vercel (`/api`); set for local Nest |
| `API_INTERNAL_URL` | web | Injected by binding — server-only |
| `EXPO_PUBLIC_API_URL` | mobile (EAS) | `https://<prod>/api` |
