-- =========================
-- OSHA Compliance Feature Migration
-- =========================
-- Adds OSHA compliance fields to kits table and creates necessary compliance tables

-- =========================
-- 1. Create osha_compliance_rules table
-- =========================

CREATE TABLE IF NOT EXISTS osha_compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry VARCHAR(255) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  description TEXT,
  required_supplies JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {supplyId, supplyName, quantity, supplyType}
  group_size_min INTEGER NOT NULL DEFAULT 1,
  group_size_max INTEGER,
  environment VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osha_compliance_rules_industry ON osha_compliance_rules(industry);
CREATE INDEX IF NOT EXISTS idx_osha_compliance_rules_is_active ON osha_compliance_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_osha_compliance_rules_industry_active ON osha_compliance_rules(industry, is_active);

CREATE TRIGGER trg_osha_compliance_rules_updated_at
  BEFORE UPDATE ON osha_compliance_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- 2. Create compliance_checks table (if it doesn't exist)
-- =========================

CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  osha_rule_id UUID NOT NULL REFERENCES osha_compliance_rules(id),
  osha_rule_name VARCHAR(255), -- Denormalized
  compliance_status VARCHAR(50) NOT NULL CHECK (compliance_status IN ('compliant', 'non_compliant', 'partial')),
  compliance_score INTEGER NOT NULL DEFAULT 0 CHECK (compliance_score >= 0 AND compliance_score <= 100),
  missing_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {supplyId, supplyName, requiredQuantity, actualQuantity}
  extra_items JSONB DEFAULT '[]'::jsonb, -- Array of {supplyId, supplyName, quantity}
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_user_id ON compliance_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_kit_id ON compliance_checks(kit_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_osha_rule_id ON compliance_checks(osha_rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_compliance_status ON compliance_checks(compliance_status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_checked_at ON compliance_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status_checked_at ON compliance_checks(compliance_status, checked_at);

-- =========================
-- 3. Add OSHA fields to kits table
-- =========================

ALTER TABLE kits
  ADD COLUMN IF NOT EXISTS is_osha_kit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS osha_kit_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS osha_rule_id UUID REFERENCES osha_compliance_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(50) CHECK (compliance_status IN ('compliant', 'non_compliant', 'partial', 'not_checked')),
  ADD COLUMN IF NOT EXISTS compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
  ADD COLUMN IF NOT EXISTS last_compliance_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compliance_metadata JSONB;

-- Add indexes for OSHA fields
CREATE INDEX IF NOT EXISTS idx_kits_is_osha_kit ON kits(is_osha_kit);
CREATE INDEX IF NOT EXISTS idx_kits_osha_kit_type ON kits(osha_kit_type);
CREATE INDEX IF NOT EXISTS idx_kits_osha_rule_id ON kits(osha_rule_id);
CREATE INDEX IF NOT EXISTS idx_kits_compliance_status ON kits(compliance_status);
CREATE INDEX IF NOT EXISTS idx_kits_osha_kit_status ON kits(is_osha_kit, compliance_status);

-- Add constraint: if is_osha_kit is true, osha_kit_type must be set
ALTER TABLE kits
  ADD CONSTRAINT chk_osha_kit_type_required 
  CHECK (NOT is_osha_kit OR osha_kit_type IS NOT NULL);
