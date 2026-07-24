# Soft launch checklist

## Infrastructure

- [x] Create Supabase project (dev) and apply `supabase/migrations/0001_init.sql` (`jszxqowkkyjmplbzbgvf`)
- [ ] Set Auth providers: email, Google, Apple
- [ ] Configure `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET` for API
- [ ] Deploy web + API as [Vercel Services](./VERCEL.md) (one project; Docker/Cloud Run is fallback only)
- [ ] Leave web `NEXT_PUBLIC_API_URL` unset (same-origin `/api`); point Expo `EXPO_PUBLIC_API_URL` at `https://<deployment>/api`
- [ ] Enable Deployment Protection on previews + Playwright bypass secret
- [ ] Enable Web Analytics + Speed Insights on web

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

- [ ] Privacy + terms reviewed
- [ ] Pricing page matches RC products
- [ ] Support contact listed

## Explicitly not in v1 launch

- AI, compliance, affiliates, API keys, custom fields, dual Stripe checkout
