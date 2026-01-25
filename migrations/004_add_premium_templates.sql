-- =========================
-- Add Premium Template Support
-- =========================
-- Adds requires_premium field to kit_templates table

ALTER TABLE kit_templates
  ADD COLUMN IF NOT EXISTS requires_premium BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_kit_templates_requires_premium ON kit_templates(requires_premium);
CREATE INDEX IF NOT EXISTS idx_kit_templates_public_premium ON kit_templates(is_public, requires_premium, is_active) 
  WHERE is_public = true AND is_active = true;
