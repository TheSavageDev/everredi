# Vercel platform plan (EverRedi)

Research against current Vercel docs (Services public beta, June 2026) and this monorepo.

## What is implemented in code

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | **Vercel Services** (`web` + `api`) | `vercel.json` |
| P0 | **Cron** expiration / low-stock alerts | `GET /api/cron/alerts` → Nest `/api/internal/cron/alerts` (daily 13:00 UTC) |
| P0 | **Security headers** + CSP | top-level `headers` in `vercel.json` |
| P0 | **Fluid compute** | `"fluid": true` |
| P0/P1 | **Deployment Protection bypass** for Playwright | `playwright.config.ts` + `.github/workflows/preview-e2e.yml` |
| P1 | **Web Analytics** + **Speed Insights** | root layout |
| P1 | **BotID** | `instrumentation-client.ts` + `/api/auth/bootstrap`, `/api/blob/upload` |
| P1 | **Throttling** on Nest | global `ThrottlerGuard` |
| P2 | **Queues** (`workspace-alerts` topic) | cron `?dispatch=queue` + consumer route |
| P2 | **Workflow** durable fan-out | cron `?dispatch=workflow` + `workflows/workspace-alerts.ts` |
| P2 | **Edge Config** flags | `maintenanceMode`, `signupEnabled`, `alertsDispatch` via middleware |
| P2 | **Blob** client upload | `/api/blob/upload` + `lib/blob.ts` |

Sandbox is intentionally **not** wired (post-v1 AI / RediBot only).

## Services routing

| Path | Service |
|------|---------|
| `/api/cron/*`, `/api/queues/*`, `/api/blob/*`, `/api/auth/bootstrap`, `/.well-known/workflow/*` | `web` |
| `/api/*` (everything else) | `api` (Nest) |
| `/*` | `web` |

Nest keeps `globalPrefix('api')`. Browser / mobile use public `/api`. Server-side web code uses binding `API_INTERNAL_URL`.

### Local / deploy

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Prefer vercel dev for production-like Services + bindings:
vercel link
vercel env pull
vercel dev   # or: vercel dev -L
```

Production: leave `NEXT_PUBLIC_API_URL` unset; set mobile `EXPO_PUBLIC_API_URL=https://<deployment>/api`.

---

## Dashboard checklist (must click in Vercel)

These cannot be fully expressed as repo files — complete after first project link:

### P0 / P1 platform settings

- [ ] Create Vercel project from this repo; framework / mode = **Services**
- [ ] Enable **Fluid compute** (default on new projects; confirm)
- [ ] **Deployment Protection**: Vercel Authentication on Preview (and Staging if used)
- [ ] Generate **Protection Bypass for Automation** → GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET`
- [ ] Enable **Skew Protection**
- [ ] Enable **Web Analytics** + **Speed Insights** for the project (SDK already mounted)
- [ ] **Firewall** → enable managed ruleset (`vercel_ruleset` / OWASP); allowlist RevenueCat webhook IP/path if it false-positives (`POST /api/subscriptions/revenuecat/webhook`)
- [ ] **Observability**: turn on runtime logs; optional Log Drain to your sink
- [ ] Set shared env (Production + Preview):  
  `DATABASE_URL`, `SUPABASE_*`, `CRON_SECRET`, `REVENUECAT_*`, `NEXT_PUBLIC_SUPABASE_*`, `BLOB_READ_WRITE_TOKEN`, `EDGE_CONFIG`

### P2 storage / networking

- [ ] Create **Edge Config** store; connect to project (`EDGE_CONFIG`); seed keys:  
  `maintenanceMode=false`, `signupEnabled=true`, `alertsDispatch="sync"`
- [ ] Create **Blob** store; connect token as `BLOB_READ_WRITE_TOKEN`
- [ ] Enable **Queues** beta for the project (topic `workspace-alerts` is declared in `vercel.json`)
- [ ] Optional: **Marketplace → Supabase** for credential injection (current project `jszxqowkkyjmplbzbgvf` already works via env)
- [ ] Optional: **Connect** / OIDC for short-lived third-party creds
- [ ] Optional: **Secure Compute** / static IPs only if Postgres must leave the public Supabase pooler

### Cron / dispatch modes

| Mode | How | When |
|------|-----|------|
| `sync` (default) | Cron → Nest full scan | Soft launch |
| `queue` | Cron enqueues per workspace; consumer processes | Larger workspaces |
| `workflow` | Durable Workflow SDK fan-out | Need crash-safe retries |

Set Edge Config `alertsDispatch` or call `/api/cron/alerts?dispatch=queue|workflow` (still requires `Authorization: Bearer $CRON_SECRET`).

---

## Env matrix

| Variable | Where | Notes |
|----------|-------|--------|
| `DATABASE_URL` | api | Supabase Postgres |
| `SUPABASE_URL` / `JWT_SECRET` / `SERVICE_ROLE_KEY` | api | |
| `CRON_SECRET` | api + web | Cron + internal Nest routes |
| `REVENUECAT_*` | api | |
| `NEXT_PUBLIC_SUPABASE_*` | web | |
| `NEXT_PUBLIC_API_URL` | web | Unset on Vercel |
| `API_INTERNAL_URL` | web | Binding (injected) |
| `EDGE_CONFIG` | web | Flags |
| `BLOB_READ_WRITE_TOKEN` | web | Uploads |
| `EXPO_PUBLIC_API_URL` | mobile | `https://<prod>/api` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | GitHub Actions | Preview e2e |

---

## Explicit non-goals

- Dual Stripe checkout in app (product backlog)
- Sandbox / agent Linux VMs (post-v1 AI)
- Hosting Expo on Vercel (EAS stays)
- Dropping Dockerfiles until Services is proven in production
