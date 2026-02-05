-- Add 'incomplete' and 'complete' to kit_status enum so kits can be stored with derived status
-- (active and archived remain; complete/incomplete used when deriving from item fulfillment)
ALTER TYPE kit_status ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE kit_status ADD VALUE IF NOT EXISTS 'complete';
