-- Alert thresholds: per-user expiration alert days/levels
-- Low stock alerts: per-user supply minimum quantity alerts
-- These tables are used by advanced-notifications (API) and low-stock cron.

CREATE TABLE IF NOT EXISTS alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES supply_categories(id) ON DELETE SET NULL,
  days_before_expiration INTEGER NOT NULL CHECK (days_before_expiration > 0),
  alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('warning', 'critical')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_thresholds_user_id ON alert_thresholds(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_user_active ON alert_thresholds(user_id, is_active) WHERE is_active = true;

CREATE TRIGGER update_alert_thresholds_updated_at
  BEFORE UPDATE ON alert_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  supply_name VARCHAR(255) NOT NULL,
  minimum_quantity INTEGER NOT NULL CHECK (minimum_quantity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_user_id ON low_stock_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_user_active ON low_stock_alerts(user_id, is_active) WHERE is_active = true;

CREATE TRIGGER update_low_stock_alerts_updated_at
  BEFORE UPDATE ON low_stock_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
