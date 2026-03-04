-- =========================
-- Seed OSHA Required Supplies
-- =========================
-- This seed file adds supplies required for OSHA-compliant kits that may not exist in the base catalog
-- Run this after 001_seed_supply_catalog.sql

-- Get category IDs (using the fixed UUIDs from 001_seed_supply_catalog.sql)
-- Bandages & Wound Care: 'a1b2c3d4-e5f6-4789-a012-345678901234'
-- Emergency & Trauma: 'd4e5f6a7-b8c9-4012-d345-678901234567'
-- Personal Protection: 'e5f6a7b8-c9d0-4123-e456-789012345678'
-- Hygiene & Sanitation: 'f6a7b8c9-d0e1-4234-f567-890123456789'
-- Respiratory: 'c9d0e1f2-a3b4-4567-c890-123456789012'
-- Documentation & Reference: 'd0e1f2a3-b4c5-4678-d901-234567890123'

-- Insert OSHA-specific supplies
INSERT INTO supplies (
  name,
  description,
  category_id,
  category_name,
  unit_type,
  base_unit,
  expires,
  default_expiration_days,
  osha_required,
  scope,
  tenant_id,
  created_at,
  updated_at
)
VALUES
  -- Bandages & Wound Care
  (
    'Gauze pads (4x4 inches)',
    'Sterile gauze pads measuring 4x4 inches for wound dressing',
    'a1b2c3d4-e5f6-4789-a012-345678901234',
    'Bandages & Wound Care',
    'pack',
    'each',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  (
    'Gauze pads (8x10 inches)',
    'Sterile gauze pads measuring 8x10 inches for larger wound dressing',
    'a1b2c3d4-e5f6-4789-a012-345678901234',
    'Bandages & Wound Care',
    'pack',
    'each',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  (
    'Gauze roller bandage (2 inches wide)',
    'Roll of sterile gauze bandage, 2 inches wide, for wrapping wounds',
    'a1b2c3d4-e5f6-4789-a012-345678901234',
    'Bandages & Wound Care',
    'roll',
    'each',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  (
    'Triangular bandages',
    'Triangular cloth bandages for slings, splints, and large wound dressings',
    'a1b2c3d4-e5f6-4789-a012-345678901234',
    'Bandages & Wound Care',
    'piece',
    'each',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  (
    'Adhesive tape',
    'Medical adhesive tape for securing bandages and dressings',
    'a1b2c3d4-e5f6-4789-a012-345678901234',
    'Bandages & Wound Care',
    'roll',
    'each',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  (
    'Elastic wraps',
    'Elastic compression bandages for sprains, strains, and support',
    'a1b2c3d4-e5f6-4789-a012-345678901234',
    'Bandages & Wound Care',
    'roll',
    'each',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  
  -- Hygiene & Sanitation
  (
    'Wound cleaning agent',
    'Antiseptic solution or wipes for cleaning wounds before dressing',
    'f6a7b8c9-d0e1-4234-f567-890123456789',
    'Hygiene & Sanitation',
    'bottle',
    'each',
    true,
    1095,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  
  -- Personal Protection
  (
    'Latex gloves',
    'Disposable latex examination gloves for infection control',
    'e5f6a7b8-c9d0-4123-e456-789012345678',
    'Personal Protection',
    'box',
    'pair',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  
  -- Emergency & Trauma
  (
    'Foil blanket',
    'Emergency thermal blanket (space blanket) for hypothermia prevention',
    'd4e5f6a7-b8c9-4012-d345-678901234567',
    'Emergency & Trauma',
    'piece',
    'each',
    false,
    NULL,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  
  -- Respiratory
  (
    'Resuscitation equipment',
    'CPR face shield or pocket mask for safe rescue breathing',
    'c9d0e1f2-a3b4-4567-c890-123456789012',
    'Respiratory',
    'piece',
    'each',
    true,
    1825,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  ),
  
  -- Documentation & Reference
  (
    'Emergency assistance directions',
    'First aid instruction card or guide for emergency procedures',
    'd0e1f2a3-b4c5-4678-d901-234567890123',
    'Documentation & Reference',
    'piece',
    'each',
    false,
    NULL,
    true,
    'global',
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name)) DO NOTHING;
