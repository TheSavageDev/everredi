# Database schema

Overview of the Supabase (PostgreSQL) schema used by the API. The API uses the **service role** and bypasses RLS; RLS is enabled for defense-in-depth when the anon key or RLS-aware roles are used.

## Enums

| Type | Values |
|------|--------|
| `tenant_type` | personal, team |
| `member_role` | owner, admin, member |
| `kit_status` | active, archived, incomplete, complete |
| `permission_level` | view, edit, admin |
| `inventory_lot_status` | active, expired, used, disposed |
| `inventory_item_status` | complete, partial, missing, used, disposed, expired |

## Core tables

### users
User accounts (synced with Supabase Auth). `id` matches `auth.users.id`. Subscription, referral, and profile fields.

### locations
User-scoped storage locations (home, office, vehicle, backpack, general). Referenced by kits and inventory_items.

### tenants, tenant_members, user_defaults
Multi-tenancy: personal and team tenants, membership, and default tenant per user. Most data is scoped by `tenant_id`.

### supply_categories, supplies, supply_variants
Supply catalog: global and tenant-scoped categories and supplies, with variants (e.g. sizes). Used by kit templates and inventory.

### kit_templates, kit_template_revisions, kit_template_revision_items
Templates for kits: name, purpose, group_size, is_public, requires_premium. Revisions version the template; items link to supplies and required_units.

### kits
Tenant-scoped kits. Optional `location_id`, `template_revision_id`, and status (active, archived, incomplete, complete). OSHA/compliance fields when used as compliance kits.

### inventory_items
Consolidated kit items and standalone inventory. Key columns:
- **Tenant/kit:** `tenant_id`, `kit_id` (NULL = not in a kit).
- **Supply:** `supply_id` + `supply_name`, or `freeform_name` when not from catalog; `supply_category_id` denormalized.
- **Quantity:** `required_quantity` (for kit items), `actual_quantity` (on-hand). Status derived: complete / partial / missing (plus used, disposed, expired).
- **Location:** `location_id`, `location_name`.
- **Lifecycle:** `expiration_date`, `purchase_date`, `lot_code`, `status` (enum).
- **Metadata:** `notes`, `custom_fields`. Expiration notification tracking uses `notification_events` (event_key e.g. `expiry:<item_id>:<days>`).

Kit items: one row per (kit, supply or freeform). Fulfillment status from `actual_quantity` vs `required_quantity`.

### inventory_lots
Optional: multiple lots per inventory item (e.g. different expirations). Present in schema; migration 006 moved lot data onto `inventory_items` for the main flow. Check migrations for your environment.

### kit_acl, share_links
Access: per-kit permissions (user or tenant_role) and share links (token, permission, expires_at).

### notifications, device_tokens, notification_preferences, notification_events
In-app notifications, push tokens, preferences (expiry warning days, push/email), and event log for sent notifications.

### alert_thresholds, low_stock_alerts
User-configurable expiry and low-stock alerts (e.g. by category or supply, with cooldowns).

### scheduled_broadcasts
Admin-only; scheduled broadcast messages (title, body, scheduled_at, status).

### teams, team_members
**Teams** are the user-facing collaboration feature: web and frontend call `/teams` (list, create, get, members). The API uses the `teams` and `team_members` tables only for this feature. **Tenants** are the data boundary: kits, inventory, and sharing are scoped by `tenant_id` (personal or team-type tenant). The API never exposes "tenant" to clients; it resolves the user’s default tenant server-side. **Recommendation:** Keep both. No code changes required. Teams drive the Teams UI; tenants drive kit/inventory ownership. If you later want one model, you could map each team to a tenant of type `team` and use `tenant_members` for membership, then deprecate the `teams` table.

### api_keys, support_tickets, affiliate_tracking, brand_partnerships, revenuecat_customers
API keys per user, support tickets, affiliate tracking, brand partnerships, RevenueCat customer mapping.

### ai_recommendations
AI-generated kit recommendations (prompt, purpose, recommended_items, was_used).

### osha_compliance_rules, compliance_checks
OSHA rules (industry, required_supplies, group_size) and per-kit compliance check results.

## Row Level Security (RLS)

RLS is enabled on public tables and all policies are created in `000_consolidated_schema.sql` (one policy per operation where needed, `(select auth.uid())`, admin-only for scheduled_broadcasts). The API uses the service role and does not enforce RLS; these policies protect direct Supabase client access (e.g. anon key).

## Views

- **v_kit_actual_units** – Aggregates actual units per kit from inventory_lots (if in use).
- **v_kit_item_status** – Per kit item: required_quantity, actual_quantity, derived status. May reference `inventory_items.quantity` in older schema; current schema uses `required_quantity` / `actual_quantity`.

## Migration order

- **Fresh install (only path):** Run `000_consolidated_schema.sql` (schema + RLS), then optionally `001_seed_supply_catalog.sql`. No other migrations. See [migrations/README.md](./migrations/README.md).

---

## Schema review and recommendations

### Documentation and consistency

- **000_consolidated_schema.sql** is the single source of truth: `inventory_items` uses `required_quantity`, `actual_quantity`, `inventory_item_status` enum; no `sent_notifications` or `inventory_lots`; RLS is included. `v_kit_item_status` reads from `inventory_items` and `kits` only.

### Security (Supabase Advisor)

- **Leaked password protection (WARN):** Supabase Auth can check passwords against HaveIBeenPwned. Enable in Dashboard → Authentication → Settings (requires Pro plan).

### Performance (Supabase Advisor)

- **Unindexed foreign keys (INFO):** Several FKs have no covering index (e.g. `affiliate_tracking.supply_id`, `alert_thresholds.category_id`, `inventory_items.supply_category_id`, `kit_template_revisions.created_by`, `kits.template_revision_id`, `share_links.owner_id`, `user_defaults.default_tenant_id`). Add indexes on these columns if you run joins or lookups on them frequently.
- **Unused indexes (INFO):** Many indexes are reported as never used. Consider dropping only after confirming the columns are not used in app or reporting queries (e.g. keep indexes used by RLS or by the API). Re-measure after traffic is representative.

### Design and maintainability

- **Teams vs tenants:** Both `teams`/`team_members` and `tenants`/`tenant_members` exist. If tenants are the primary collaboration model, consider deprecating or consolidating teams to avoid two parallel models.
- **sent_notifications:** Not in schema; expiration cooldown is tracked in `notification_events` (event_key `expiry:<item_id>:<days>`).
- **inventory_lots:** Not in the consolidated schema; lot data lives on `inventory_items` (e.g. `lot_code`, `expiration_date`).
