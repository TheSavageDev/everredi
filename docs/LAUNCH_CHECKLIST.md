# Soft launch checklist

## Infrastructure

- [x] Create Supabase project (dev) and apply `supabase/migrations/0001_init.sql` (`jszxqowkkyjmplbzbgvf`)
- [ ] Set Auth providers: email, Google, Apple (see [AUTH.md](./AUTH.md); web + mobile UI wired)
- [ ] Configure `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET` for API
- [ ] Deploy web + API as [Vercel Services](./VERCEL.md) (one project; Docker/Cloud Run is fallback only)
- [ ] Leave web `NEXT_PUBLIC_API_URL` unset (same-origin `/api`); point Expo `EXPO_PUBLIC_API_URL` at `https://<deployment>/api`
- [ ] Set `CRON_SECRET` on web + api; confirm daily `/api/cron/alerts` in Vercel Cron
- [ ] Complete [Vercel dashboard checklist](./VERCEL.md#dashboard-checklist-must-click-in-vercel) (Protection, Firewall, Skew, Edge Config, Blob, Queues)
- [x] Web Analytics + Speed Insights SDK mounted (enable in project dashboard)
- [x] BotID on auth bootstrap + blob upload
- [x] Playwright preview-e2e workflow + protection bypass headers

## Billing

- [ ] RevenueCat project with entitlement **`everredi-pro`** (exact spelling)
- [ ] Products: monthly $4.99, yearly $39.99, lifetime $99.99
- [ ] Webhook → `POST /api/subscriptions/revenuecat/webhook` with shared secret
- [ ] Verify free limits enforced server-side (5 kits / 100 items / 2 locations / 3 members)

## Clients

- [ ] Web: sign up → create kit → add inventory → invite member → see alerts
- [ ] Mobile: same smoke path on iOS simulator + Android emulator
- [ ] EAS project configured for `app.everredi`
- [ ] Playwright smoke green against staging web

## Legal / marketing

- [x] Privacy, terms, EULA, and disclaimer pages shipped (`/privacy`, `/terms`, `/eula`, `/disclaimer`)
- [ ] Legal copy reviewed by counsel (optional but recommended before paid launch)
- [ ] Pricing page matches RC products
- [x] Support contact listed (`support@everredi.app` on footer + legal pages)

## Explicitly not in v1 launch

- AI, compliance, affiliates, API keys, custom fields, dual Stripe checkout
