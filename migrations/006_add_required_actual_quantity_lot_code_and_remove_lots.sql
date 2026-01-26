-- Migration: Add required_quantity, actual_quantity, lot_code columns and remove inventory_lots
-- This migration:
-- 1. Adds lot_code column to preserve lot data
-- 2. Converts inventory_lots to separate inventory_items (preserving all lot data)
-- 3. Drops inventory_lots table
-- 4. Adds required_quantity and actual_quantity columns
-- 5. Populates the new columns with existing data

-- Step 1: Add lot_code column to inventory_items (preserve lot-specific data)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS lot_code TEXT;

-- Step 2: Convert inventory_lots to separate inventory_items
-- Strategy: Update items WITH lots to include their own lot data (convert them in place)
-- Items with lots become the final items with lot data directly on them
-- Note: Due to unique constraint on (kit_id, supply_id), there can only be one item per combination
-- So we update items with lots in place - they become the canonical items with lot data

-- Step 2a: Update items WITH lots to include their own aggregated lot data
UPDATE inventory_items existing
SET
  quantity = lot_data.quantity,
  lot_code = lot_data.lot_code,
  expiration_date = lot_data.expiration_date,
  purchase_date = lot_data.purchase_date,
  purchase_price = lot_data.purchase_price,
  supplier = lot_data.supplier,
  updated_at = lot_data.updated_at
FROM (
  SELECT
    ii.id,
    SUM(il.quantity_units) AS quantity,
    MIN(il.expiration_date) AS expiration_date,
    MIN(il.purchase_date) AS purchase_date,
    MIN(il.purchase_price) AS purchase_price,
    (array_agg(il.supplier ORDER BY il.created_at))[1] AS supplier,
    string_agg(DISTINCT il.lot_code, ', ' ORDER BY il.lot_code) AS lot_code,
    MAX(il.updated_at) AS updated_at
  FROM inventory_lots il
  JOIN inventory_items ii ON il.inventory_item_id = ii.id
  WHERE il.quantity_units > 0
  GROUP BY ii.id
) lot_data
WHERE existing.id = lot_data.id;

-- Step 2b: Update items WITHOUT lots that match (kit_id, supply_id) from items WITH lots
-- This handles the case where there's an item without lots that should get lot data from a matching item with lots
WITH lot_aggregates AS (
  SELECT
    ii.kit_id,
    ii.supply_id,
    SUM(il.quantity_units) AS quantity,
    MIN(il.expiration_date) AS expiration_date,
    string_agg(DISTINCT il.lot_code, ', ' ORDER BY il.lot_code) AS lot_code,
    MAX(il.updated_at) AS updated_at
  FROM inventory_lots il
  JOIN inventory_items ii ON il.inventory_item_id = ii.id
  WHERE il.quantity_units > 0
    AND ii.kit_id IS NOT NULL
    AND ii.supply_id IS NOT NULL
  GROUP BY ii.kit_id, ii.supply_id
)
UPDATE inventory_items existing
SET
  quantity = existing.quantity + la.quantity,
  lot_code = CASE 
    WHEN existing.lot_code IS NULL THEN la.lot_code
    WHEN la.lot_code IS NULL THEN existing.lot_code
    ELSE existing.lot_code || ', ' || la.lot_code
  END,
  expiration_date = LEAST(
    COALESCE(existing.expiration_date, '9999-12-31'::date),
    COALESCE(la.expiration_date, '9999-12-31'::date)
  ),
  updated_at = GREATEST(existing.updated_at, la.updated_at)
FROM lot_aggregates la
WHERE existing.kit_id = la.kit_id
  AND existing.supply_id = la.supply_id
  AND existing.kit_id IS NOT NULL
  AND existing.supply_id IS NOT NULL
  AND existing.id NOT IN (SELECT DISTINCT inventory_item_id FROM inventory_lots);

-- Step 3: Drop inventory_lots table (data has been migrated to inventory_items)
-- Note: We don't delete items with lots - they were updated in Step 2b to include their lot data
DROP TABLE IF EXISTS inventory_lots CASCADE;

-- Step 4: Add required_quantity and actual_quantity columns to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS required_quantity INTEGER CHECK (required_quantity >= 0),
  ADD COLUMN IF NOT EXISTS actual_quantity INTEGER CHECK (actual_quantity >= 0);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_required_quantity
  ON inventory_items(required_quantity) WHERE required_quantity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_actual_quantity
  ON inventory_items(actual_quantity) WHERE actual_quantity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_lot_code
  ON inventory_items(lot_code) WHERE lot_code IS NOT NULL;

-- Step 5: Populate existing data
-- For requirements (is_requirement = true): set required_quantity = quantity
UPDATE inventory_items
SET required_quantity = quantity
WHERE is_requirement = true;

-- For actual items in kits: populate required_quantity from matching requirements
UPDATE inventory_items AS actual
SET required_quantity = req.quantity
FROM inventory_items AS req
WHERE actual.kit_id = req.kit_id
  AND actual.is_requirement = false
  AND req.is_requirement = true
  AND (
    (actual.supply_id IS NOT NULL AND actual.supply_id = req.supply_id)
    OR (actual.supply_id IS NULL AND actual.freeform_name = req.freeform_name)
  );

-- For actual items: actual_quantity = quantity (no aggregation needed)
UPDATE inventory_items
SET actual_quantity = quantity
WHERE is_requirement = false;

-- Step 6: Add triggers for automatic maintenance
-- Trigger to keep actual_quantity in sync with quantity
CREATE OR REPLACE FUNCTION sync_actual_quantity_with_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_requirement = false THEN
    NEW.actual_quantity = NEW.quantity;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_actual_quantity
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  WHEN (NEW.is_requirement = false)
  EXECUTE FUNCTION sync_actual_quantity_with_quantity();

-- Trigger to update required_quantity on actual items when requirements change
CREATE OR REPLACE FUNCTION update_required_quantity_on_requirement_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_requirement = true THEN
    UPDATE inventory_items
    SET required_quantity = NEW.quantity
    WHERE kit_id = NEW.kit_id
      AND is_requirement = false
      AND (
        (NEW.supply_id IS NOT NULL AND supply_id = NEW.supply_id)
        OR (NEW.supply_id IS NULL AND freeform_name = NEW.freeform_name)
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_required_quantity_on_requirement_change
  AFTER INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  WHEN (NEW.is_requirement = true)
  EXECUTE FUNCTION update_required_quantity_on_requirement_change();
