-- Migration: Remove is_requirement (unify row type) and set kit delete to CASCADE
-- 1. Drop trigger/function that syncs requirement -> actual (one row per kit+supply now)
-- 2. Drop index and column is_requirement
-- 3. Change inventory_items.kit_id to ON DELETE CASCADE

-- Step 1: Drop trigger and function (if present; from incremental migrations 006/007)
DROP TRIGGER IF EXISTS trigger_update_required_quantity_on_requirement_change ON inventory_items;
DROP FUNCTION IF EXISTS update_required_quantity_on_requirement_change();

-- Step 2: Drop index and column
DROP INDEX IF EXISTS idx_inventory_items_is_requirement;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS is_requirement;

-- Step 3: Change kit_id FK from ON DELETE SET NULL to ON DELETE CASCADE
-- Constraint name is the default: inventory_items_kit_id_fkey
ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_kit_id_fkey;

ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_kit_id_fkey
  FOREIGN KEY (kit_id) REFERENCES kits(id) ON DELETE CASCADE;
