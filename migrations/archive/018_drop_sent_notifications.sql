-- Drop deprecated sent_notifications column from inventory_items.
-- Expiration notification tracking now uses notification_events (event_key e.g. expiry:<item_id>:<days>).

ALTER TABLE inventory_items DROP COLUMN IF EXISTS sent_notifications;
