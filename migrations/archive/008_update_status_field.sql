-- Migration: Update status field to use ENUM type with complete | partial | missing | used | disposed | expired
-- This migration converts the status field to a PostgreSQL ENUM for better type safety and performance

-- Step 1: First, update any NULL or invalid status values to a safe default
-- Also trim any whitespace from status values
UPDATE inventory_items
SET status = 'missing'
WHERE status IS NULL 
   OR status NOT IN ('complete', 'partial', 'missing', 'used', 'disposed', 'expired')
   OR status != TRIM(status);

-- Trim whitespace from all status values
UPDATE inventory_items
SET status = TRIM(status)
WHERE status IS NOT NULL AND status != TRIM(status);

-- Step 2: Calculate and update status based on actual_quantity vs required_quantity
-- Only update items that are in fulfillment states (not used/disposed/expired)
-- For items with required_quantity set (kit items):
UPDATE inventory_items
SET status = CASE
  WHEN actual_quantity >= COALESCE(required_quantity, 0) THEN 'complete'
  WHEN actual_quantity > 0 THEN 'partial'
  ELSE 'missing'
END
WHERE required_quantity IS NOT NULL
  AND status IN ('complete', 'partial', 'missing');

-- For standalone items (no required_quantity), set based on actual_quantity:
-- If they have quantity, they're "complete" (they have what they need)
-- If they have 0, they're "missing"
UPDATE inventory_items
SET status = CASE
  WHEN actual_quantity > 0 THEN 'complete'
  ELSE 'missing'
END
WHERE required_quantity IS NULL
  AND status IN ('complete', 'partial', 'missing');

-- Step 3: Drop the old index that filters by 'active' status
DROP INDEX IF EXISTS idx_inventory_items_expiring;

-- Step 4: Drop ALL check constraints on the status column
-- PostgreSQL may have created constraints with different names (inline CHECK constraints)
-- We need to find and drop all of them
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find and drop all check constraints that involve the status column
  FOR constraint_record IN
    SELECT conname, pg_get_constraintdef(oid) as constraint_def
    FROM pg_constraint
    WHERE conrelid = 'inventory_items'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) LIKE '%status%'
        OR conname LIKE '%status%'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_record.conname);
      RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop constraint %: %', constraint_record.conname, SQLERRM;
    END;
  END LOOP;
END $$;

-- Also try to drop the named constraint explicitly (in case it exists)
ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_status_check CASCADE;

-- Step 5: Create ENUM type for inventory item status
DO $$
BEGIN
  -- Drop the enum type if it exists (in case of re-running migration)
  DROP TYPE IF EXISTS inventory_item_status CASCADE;
  
  -- Create the enum type with all status values
  CREATE TYPE inventory_item_status AS ENUM (
    'complete',
    'partial',
    'missing',
    'used',
    'disposed',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN
  -- Enum already exists, that's fine
  NULL;
END $$;

-- Step 6: Convert the status column to use the ENUM type
-- First, update any existing values to ensure they're valid enum values
UPDATE inventory_items
SET status = 'missing'
WHERE status NOT IN ('complete', 'partial', 'missing', 'used', 'disposed', 'expired');

-- Step 7: Remove the default value temporarily (needed for type conversion)
ALTER TABLE inventory_items
  ALTER COLUMN status DROP DEFAULT;

-- Step 8: Convert the column type to the enum
ALTER TABLE inventory_items
  ALTER COLUMN status TYPE inventory_item_status
  USING status::inventory_item_status;

-- Step 9: Ensure status column is NOT NULL and set default value with proper enum type
-- Only set NOT NULL if it's not already NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' 
      AND column_name = 'status' 
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE inventory_items ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

-- Set the default value using the enum type
ALTER TABLE inventory_items
  ALTER COLUMN status SET DEFAULT 'missing'::inventory_item_status;

-- Step 10: Create new index for expiration queries (no longer filtering by status)
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiring 
ON inventory_items(expiration_date) 
WHERE expiration_date IS NOT NULL;
