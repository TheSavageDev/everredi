# Database Migrations

This directory contains SQL migration files for the Supabase PostgreSQL database.

## Migration Strategy

**For new installations**: Use the single consolidated migration file `000_consolidated_schema.sql` which represents the final, clean database state.

**For existing databases**: The old incremental migrations (001-999) are kept for historical reference only. They should not be run on new installations.

## Consolidated Migration

### `000_consolidated_schema.sql`

This is the **single source of truth** for new database installations. It includes:

- **Clean schema** - No deprecated tables, no legacy columns
- **Consolidated inventory_items** - Merges `kit_items` and old `inventory_items` into a single table
- **Direct kits table** - No containers abstraction, no user_kits table
- **Multi-tenancy** - Full tenant support via `tenants` and `tenant_members` tables
- **No firebase_uid** - Fully migrated to Supabase authentication
- **All indexes, triggers, views** - Complete schema with all optimizations

### Key Design Decisions

#### Consolidated Inventory Items

The `inventory_items` table consolidates both kit items and inventory:

- **Items in kits**: `kit_id` is set (not NULL)
- **Items not in kits**: `kit_id` is NULL
- **Requirements/placeholders**: Inferred by `required_quantity` set and `actual_quantity = 0` (the `is_requirement` column was removed)
- **All inventory tracking**: expiration, purchase info, custom fields, etc.

This eliminates the dual relationship problem between `kit_items` and `inventory_items`.

#### Direct Kits Table

- Kits are stored directly in the `kits` table
- No `containers` abstraction layer
- No `user_kits` table (merged into `kits`)
- Kits are tenant-scoped via `tenant_id`

#### Multi-Tenancy

- All data is tenant-scoped via `tenants` and `tenant_members` tables
- Personal tenants are created automatically for each user
- Team tenants can be created for collaboration

#### Supply Catalog

- `supplies` table contains curated catalog items
- `inventory_items.supply_id` optionally links to catalog
- `inventory_items.freeform_name` for custom items not in catalog
- Supports both global and tenant-scoped supplies

## Running Migrations

### New Installation

For a fresh database, run the consolidated migration first, then optionally seed the supply catalog:

```bash
# 1. Run the consolidated schema migration
# In Supabase SQL Editor or via psql
psql -h your-supabase-host -U postgres -d your-database -f 000_consolidated_schema.sql

# 2. (Optional) Seed the supply catalog with common first aid supplies
psql -h your-supabase-host -U postgres -d your-database -f 001_seed_supply_catalog.sql
```

### Seed Files

#### `001_seed_supply_catalog.sql`

This seed file populates the supply catalog with:
- **10 supply categories**: Bandages & Wound Care, Medications & Ointments, Tools & Instruments, Emergency & Trauma, Personal Protection, Hygiene & Sanitation, Burn Care, Cold & Heat Therapy, Respiratory, and Documentation & Reference
- **50+ common first aid supplies**: Including bandages, medications, tools, emergency supplies, PPE, and more
- **Supply variants**: Examples of size variants for adhesive bandages and nitrile gloves

All seed data uses `scope = 'global'` and `tenant_id = NULL`, making it available to all users. The seed file uses `ON CONFLICT DO NOTHING` so it's safe to run multiple times.

### Existing Database

If you have an existing database that was migrated incrementally, **do not** run the consolidated migration. Your database is already in the correct state.

## Migration History (Historical Reference Only)

The following migrations are kept for historical reference but should **not** be run on new installations:

- **001-010**: Initial schema creation (with firebase_uid)
- **011**: AI recommendations
- **012-022**: Redesign (containers, lots, revisions, etc.)
- **023-025**: Simplification (remove containers)
- **999**: Cleanup (remove firebase_uid)

All of these changes are included in `000_consolidated_schema.sql` in their final form.

## Deprecated Tables (Removed in Consolidated Schema)

These tables were removed during schema evolution:

- `containers` - Merged into `kits` table
- `user_kits` - Merged into `kits` table
- `kit_items` - Merged into `inventory_items` table
- `shared_kits` - Replaced by `kit_acl` table
- `kit_requirements` - Merged into `inventory_items` with `is_requirement` flag
- `inventory_lots` - Removed; lot data now stored directly on `inventory_items` (each lot is a separate item)

## Deprecated Columns (Removed in Migrations)

- `inventory_items.quantity` - Removed in migration 007, replaced with:
  - `actual_quantity` - Actual quantity on hand (for actual items)
  - `required_quantity` - Required quantity (for kit items, both requirements and actual items)

## Status Field Changes

- `inventory_items.status` - Updated in migration 008:
  - **Old values**: 'active', 'expired', 'used', 'disposed', 'missing' (lifecycle states)
  - **New values**: 'complete', 'partial', 'missing' (fulfillment states)
  - Status is now auto-calculated based on `actual_quantity` vs `required_quantity`:
    - `complete`: `actual_quantity >= required_quantity` (or `actual_quantity > 0` for standalone items)
    - `partial`: `actual_quantity > 0` but less than `required_quantity`
    - `missing`: `actual_quantity = 0`

## Schema Documentation

For detailed schema documentation, see `/DATABASE_SCHEMA.md` in the project root.