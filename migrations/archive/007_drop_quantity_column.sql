-- Migration: Drop quantity column from inventory_items
-- This migration removes the quantity column since we now use actual_quantity and required_quantity

-- Step 1: Ensure all quantity values are properly migrated
-- For requirements: quantity should be in required_quantity
UPDATE inventory_items
SET required_quantity = quantity
WHERE is_requirement = true
  AND required_quantity IS NULL
  AND quantity IS NOT NULL;

-- For actual items: quantity should be in actual_quantity
UPDATE inventory_items
SET actual_quantity = quantity
WHERE is_requirement = false
  AND actual_quantity IS NULL
  AND quantity IS NOT NULL;

-- Step 2: Update trigger function to remove quantity reference
-- The sync_actual_quantity_with_quantity trigger is no longer needed since we're removing quantity
DROP TRIGGER IF EXISTS trigger_sync_actual_quantity ON inventory_items;
DROP FUNCTION IF EXISTS sync_actual_quantity_with_quantity();

-- Step 3: Update the requirement change trigger to use required_quantity instead of quantity
CREATE OR REPLACE FUNCTION update_required_quantity_on_requirement_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_requirement = true THEN
    UPDATE inventory_items
    SET required_quantity = NEW.required_quantity
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

-- Step 4: Drop the quantity column
ALTER TABLE inventory_items
  DROP COLUMN IF EXISTS quantity;
