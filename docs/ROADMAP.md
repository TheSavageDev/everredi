# Roadmap

## Phase 0 — Scaffold

- [x] Monorepo (pnpm/turbo), apps, packages, docs, CI

## Phase 1 — Auth + workspaces

- [x] Supabase JWT guard, user upsert, workspace bootstrap
- [x] Invite / accept / revoke members
- [x] Web + mobile sign-in shells + workspace picker

## Phase 2 — Core inventory

- [x] Locations, supplies, kits, inventory CRUD
- [x] Shared api-client usage on web + mobile

## Phase 3 — Collaboration

- [x] Many-member roles, share links, permission checks
- [x] Shared-with-me / workspace UX

## Phase 4 — Alerts + templates + Pro

- [x] Expiration / low-stock endpoints + notifications
- [x] Kit templates + create-from-template
- [x] RevenueCat webhook + free-limit enforcement

## Phase 5 — Polish + ship

- [x] Marketing pages, deploy configs, smoke tests, launch checklist

## API modules (allowed in v1)

| Module | Status |
|--------|--------|
| auth | in |
| users | in |
| workspaces | in |
| locations | in |
| supplies | in |
| kits | in |
| inventory | in |
| sharing | in |
| notifications | in |
| subscriptions | in (RevenueCat only) |
| templates | in |
