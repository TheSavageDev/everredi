# Database migrations

Single-path setup for a **fresh** Supabase (PostgreSQL) database. Deprecated and legacy paths have been removed.

## Fresh install (only path)

1. **Schema + RLS:** Run `000_consolidated_schema.sql` (tables, indexes, triggers, views, and Row Level Security).
2. **Seed catalog (optional):** Run `001_seed_supply_catalog.sql` to load supply categories and supplies.
3. **Seed default templates (optional):** Run `002_seed_kit_templates.sql` to load default public kit templates (requires 001).
4. **Seed OSHA templates (optional):** Run `003_seed_osha_templates.sql` to load OSHA-compliant premium templates (requires 001).
5. **Seed Uncharted templates (optional):** Run `004_seed_uncharted_templates.sql` to load Uncharted Supply Co premium templates (requires 001).

```bash
# 1. Schema + RLS (Supabase SQL Editor or psql)
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f migrations/000_consolidated_schema.sql

# 2. Seed catalog (optional)
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f migrations/001_seed_supply_catalog.sql

# 3. Seed default templates (optional; run after 001)
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f migrations/002_seed_kit_templates.sql

# 4. Seed OSHA premium templates (optional; run after 001)
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f migrations/003_seed_osha_templates.sql

# 5. Seed Uncharted premium templates (optional; run after 001)
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f migrations/004_seed_uncharted_templates.sql
```

No other migrations are required. The API uses the service role and bypasses RLS; RLS protects direct anon/authenticated access.

## What’s in `000_consolidated_schema.sql`

- **Schema:** users, tenants, tenant_members, user_defaults, supply_categories, supplies, supply_variants, kit_templates, kit_template_revisions, kit_template_revision_items, kits, inventory_items (with `required_quantity`, `actual_quantity`, `inventory_item_status` enum, no `sent_notifications`), kit_acl, share_links, notifications, device_tokens, notification_preferences, notification_events, custom_fields, user_categories, teams, team_members, api_keys, support_tickets, affiliate_tracking, brand_partnerships, revenuecat_customers, ai_recommendations, osha_compliance_rules, compliance_checks, scheduled_broadcasts, alert_thresholds, low_stock_alerts.
- **No** `inventory_lots`, `user_kits`, `kit_items`, `shared_kits`, or `kit_template_items`.
- **View:** `v_kit_item_status` (from `inventory_items` + `kits`).
- **RLS:** Enabled on all public tables with policies using `(select auth.uid())`; one policy per operation where it matters (e.g. kit_template_revisions); admin-only for scheduled_broadcasts.

## Seed: `001_seed_supply_catalog.sql`

Populates supply categories and supplies (global scope). Safe to run multiple times (`ON CONFLICT DO NOTHING`).

## Seed: `002_seed_kit_templates.sql`

Inserts the same default public kit templates as the API’s `TemplateSeedService` (Basic First Aid, Hiking/Outdoor, Car Emergency, Home Emergency, Workplace, Sports/Activity, Athletic Trainer, Advanced Medical/EMT, Travel). Depends on 001 (resolves supplies by name). Run once; re-running will insert duplicate templates unless you clear `kit_templates` first.

## Seed: `003_seed_osha_templates.sql`

Inserts eight OSHA-compliant premium kit templates (Class A, Class B, Construction, General Industry, Healthcare, Food Service, Warehouse, Manufacturing). Same set as `scripts/seed-osha-templates.ts`. Uses catalog supply names (e.g. Sterile Gauze Pads 4x4, Gauze Roll, First Aid Guide). Depends on 001. Run once.

## Seed: `004_seed_uncharted_templates.sql`

Inserts six Uncharted Supply Co premium kit templates (The Possibles Pouch, First Aid Plus, First Aid Pro, Triage Kit, Core, The Wolf Pack). Same set as `scripts/seed-uncharted-templates.ts`. Depends on 001 (001 includes the Uncharted-specific supply names used here). Run once.

## Archive

The folder `migrations/archive/` contains old incremental migrations (002–018). They are **not** run for a fresh install; they are kept only for reference or if you need to replay history elsewhere.

## Schema docs

See [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) for table and RLS overview.
