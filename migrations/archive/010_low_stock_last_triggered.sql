-- Low stock alerts: add last_triggered_at for 24h cooldown to avoid spamming

ALTER TABLE low_stock_alerts
  ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

COMMENT ON COLUMN low_stock_alerts.last_triggered_at IS 'When a low-stock notification was last sent for this alert; used for cooldown (e.g. 24h).';
