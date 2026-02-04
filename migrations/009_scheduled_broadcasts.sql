-- Scheduled broadcast notifications (marketing / mass push)
-- Admin creates a broadcast with scheduled_at; cron runs and sends when scheduled_at <= now()

CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_broadcasts_status ON scheduled_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_broadcasts_scheduled_at ON scheduled_broadcasts(scheduled_at);

CREATE TRIGGER update_scheduled_broadcasts_updated_at
  BEFORE UPDATE ON scheduled_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
