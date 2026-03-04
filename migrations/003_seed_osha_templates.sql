-- =========================
-- OSHA premium kit templates seed
-- =========================
-- Seeds OSHA-compliant public kit templates (requires_premium = true).
-- Same set as scripts/seed-osha-templates.ts. Run after 001 and 002.
-- Supply names are mapped to catalog: e.g. "Gauze pads (4x4 inches)" -> "Sterile Gauze Pads 4x4".

WITH tpls AS (
  INSERT INTO kit_templates (
    user_id, name, description, purpose, group_size, environment, skill_level,
    is_public, default_people_count, people_count_options, created_by, is_active, requires_premium,
    created_at, updated_at
  )
  VALUES
    (NULL, 'OSHA Class A First Aid Kit', 'ANSI Z308.1-2021 Class A compliant first aid kit for low-risk environments with smaller workforces. Addresses common workplace injuries like cuts, burns, and sprains.', 'osha-class-a', 10, 'indoor', 'beginner', true, 10, ARRAY[1, 2, 4, 6, 8], 'system', true, true, NOW(), NOW()),
    (NULL, 'OSHA Class B First Aid Kit', 'ANSI Z308.1-2021 Class B compliant comprehensive first aid kit for high-risk environments or larger operations. Contains all Class A supplies plus additional items for more severe injuries.', 'osha-class-b', 25, 'indoor', 'beginner', true, 25, ARRAY[1, 2, 4, 6, 8, 12], 'system', true, true, NOW(), NOW()),
    (NULL, 'OSHA Construction Industry First Aid Kit', 'OSHA-compliant first aid kit for construction sites. Based on OSHA 1926.50 and ANSI Z308.1-2021 Class B with construction-specific additions including eye wash solution.', 'osha-construction', 25, 'indoor', 'beginner', true, 25, ARRAY[1, 2, 4, 6, 8, 12], 'system', true, true, NOW(), NOW()),
    (NULL, 'OSHA General Industry First Aid Kit', 'OSHA-compliant first aid kit for general industry workplaces. Based on OSHA 1910.151 and ANSI Z308.1-2021 Class A requirements.', 'osha-general-industry', 10, 'indoor', 'beginner', true, 10, ARRAY[1, 2, 4, 6, 8], 'system', true, true, NOW(), NOW()),
    (NULL, 'OSHA Healthcare/Medical First Aid Kit', 'OSHA-compliant first aid kit for healthcare facilities, medical offices, and clinics. Includes supplies for bloodborne pathogen protection, sharps injuries, and medical emergencies.', 'osha-healthcare', 25, 'indoor', 'beginner', true, 25, ARRAY[1, 2, 4, 6, 8, 12], 'system', true, true, NOW(), NOW()),
    (NULL, 'OSHA Food Service/Restaurant First Aid Kit', 'OSHA-compliant first aid kit for restaurants, kitchens, and food service establishments. Emphasizes burn treatment, cuts, and food-safe wound care supplies.', 'osha-food-service', 10, 'indoor', 'beginner', true, 10, ARRAY[1, 2, 4, 6, 8], 'system', true, true, NOW(), NOW()),
    (NULL, 'OSHA Warehouse/Logistics First Aid Kit', 'OSHA-compliant first aid kit for warehouses, distribution centers, and logistics facilities. Designed for high-occupancy areas with material handling equipment and heavy lifting operations.', 'osha-warehouse', 25, 'indoor', 'beginner', true, 25, ARRAY[1, 2, 4, 6, 8, 12], 'system', true, true, NOW(), NOW()),
    (NULL, 'OSHA Manufacturing/Industrial First Aid Kit', 'OSHA-compliant first aid kit for manufacturing facilities and industrial settings. Includes supplies for machine-related injuries, chemical exposure, and eye protection needs.', 'osha-manufacturing', 25, 'indoor', 'beginner', true, 25, ARRAY[1, 2, 4, 6, 8, 12], 'system', true, true, NOW(), NOW())
  RETURNING id, name
),
revs AS (
  INSERT INTO kit_template_revisions (kit_template_id, version, created_at)
  SELECT id, 1, NOW() FROM tpls
  RETURNING id, kit_template_id
)
INSERT INTO kit_template_revision_items (template_revision_id, supply_id, required_units, created_at, updated_at)
SELECT r.id, s.id, v.qty, NOW(), NOW()
FROM (VALUES
  -- OSHA Class A (group_size 10)
  ('OSHA Class A First Aid Kit', 'Sterile Gauze Pads 4x4', 16),
  ('OSHA Class A First Aid Kit', 'Sterile Gauze Pads 8x10', 4),
  ('OSHA Class A First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 50),
  ('OSHA Class A First Aid Kit', 'Gauze Roll', 1),
  ('OSHA Class A First Aid Kit', 'Triangular Bandage', 4),
  ('OSHA Class A First Aid Kit', 'Antiseptic Wipes', 10),
  ('OSHA Class A First Aid Kit', 'Scissors', 1),
  ('OSHA Class A First Aid Kit', 'Tweezers', 1),
  ('OSHA Class A First Aid Kit', 'Emergency Blanket', 1),
  ('OSHA Class A First Aid Kit', 'Medical Tape', 1),
  ('OSHA Class A First Aid Kit', 'Disposable Gloves', 2),
  ('OSHA Class A First Aid Kit', 'CPR Face Shield', 1),
  ('OSHA Class A First Aid Kit', 'First Aid Guide', 1),
  -- OSHA Class B
  ('OSHA Class B First Aid Kit', 'Sterile Gauze Pads 4x4', 32),
  ('OSHA Class B First Aid Kit', 'Sterile Gauze Pads 8x10', 8),
  ('OSHA Class B First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 100),
  ('OSHA Class B First Aid Kit', 'Gauze Roll', 2),
  ('OSHA Class B First Aid Kit', 'Triangular Bandage', 8),
  ('OSHA Class B First Aid Kit', 'Antiseptic Wipes', 20),
  ('OSHA Class B First Aid Kit', 'Scissors', 1),
  ('OSHA Class B First Aid Kit', 'Tweezers', 1),
  ('OSHA Class B First Aid Kit', 'Emergency Blanket', 2),
  ('OSHA Class B First Aid Kit', 'Medical Tape', 2),
  ('OSHA Class B First Aid Kit', 'Disposable Gloves', 4),
  ('OSHA Class B First Aid Kit', 'CPR Face Shield', 1),
  ('OSHA Class B First Aid Kit', 'Elastic Bandage', 2),
  ('OSHA Class B First Aid Kit', 'SAM Splint', 1),
  ('OSHA Class B First Aid Kit', 'Tourniquet', 1),
  ('OSHA Class B First Aid Kit', 'First Aid Guide', 1),
  -- OSHA Construction
  ('OSHA Construction Industry First Aid Kit', 'Sterile Gauze Pads 4x4', 32),
  ('OSHA Construction Industry First Aid Kit', 'Sterile Gauze Pads 8x10', 8),
  ('OSHA Construction Industry First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 100),
  ('OSHA Construction Industry First Aid Kit', 'Gauze Roll', 2),
  ('OSHA Construction Industry First Aid Kit', 'Triangular Bandage', 8),
  ('OSHA Construction Industry First Aid Kit', 'Antiseptic Wipes', 20),
  ('OSHA Construction Industry First Aid Kit', 'Scissors', 1),
  ('OSHA Construction Industry First Aid Kit', 'Tweezers', 1),
  ('OSHA Construction Industry First Aid Kit', 'Emergency Blanket', 2),
  ('OSHA Construction Industry First Aid Kit', 'Medical Tape', 2),
  ('OSHA Construction Industry First Aid Kit', 'Disposable Gloves', 4),
  ('OSHA Construction Industry First Aid Kit', 'CPR Face Shield', 1),
  ('OSHA Construction Industry First Aid Kit', 'Elastic Bandage', 2),
  ('OSHA Construction Industry First Aid Kit', 'SAM Splint', 1),
  ('OSHA Construction Industry First Aid Kit', 'Tourniquet', 1),
  ('OSHA Construction Industry First Aid Kit', 'Eye Wash Solution', 1),
  ('OSHA Construction Industry First Aid Kit', 'First Aid Guide', 1),
  -- OSHA General Industry
  ('OSHA General Industry First Aid Kit', 'Sterile Gauze Pads 4x4', 16),
  ('OSHA General Industry First Aid Kit', 'Sterile Gauze Pads 8x10', 4),
  ('OSHA General Industry First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 50),
  ('OSHA General Industry First Aid Kit', 'Gauze Roll', 1),
  ('OSHA General Industry First Aid Kit', 'Triangular Bandage', 4),
  ('OSHA General Industry First Aid Kit', 'Antiseptic Wipes', 10),
  ('OSHA General Industry First Aid Kit', 'Scissors', 1),
  ('OSHA General Industry First Aid Kit', 'Tweezers', 1),
  ('OSHA General Industry First Aid Kit', 'Emergency Blanket', 1),
  ('OSHA General Industry First Aid Kit', 'Medical Tape', 1),
  ('OSHA General Industry First Aid Kit', 'Disposable Gloves', 2),
  ('OSHA General Industry First Aid Kit', 'CPR Face Shield', 1),
  ('OSHA General Industry First Aid Kit', 'First Aid Guide', 1),
  -- OSHA Healthcare
  ('OSHA Healthcare/Medical First Aid Kit', 'Sterile Gauze Pads 4x4', 32),
  ('OSHA Healthcare/Medical First Aid Kit', 'Sterile Gauze Pads 8x10', 8),
  ('OSHA Healthcare/Medical First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 100),
  ('OSHA Healthcare/Medical First Aid Kit', 'Gauze Roll', 2),
  ('OSHA Healthcare/Medical First Aid Kit', 'Triangular Bandage', 8),
  ('OSHA Healthcare/Medical First Aid Kit', 'Antiseptic Wipes', 70),
  ('OSHA Healthcare/Medical First Aid Kit', 'Scissors', 2),
  ('OSHA Healthcare/Medical First Aid Kit', 'Tweezers', 2),
  ('OSHA Healthcare/Medical First Aid Kit', 'Emergency Blanket', 2),
  ('OSHA Healthcare/Medical First Aid Kit', 'Medical Tape', 2),
  ('OSHA Healthcare/Medical First Aid Kit', 'Disposable Gloves', 10),
  ('OSHA Healthcare/Medical First Aid Kit', 'CPR Face Shield', 2),
  ('OSHA Healthcare/Medical First Aid Kit', 'Eye Wash Solution', 1),
  ('OSHA Healthcare/Medical First Aid Kit', 'First Aid Guide', 1),
  -- OSHA Food Service (antiseptic wipes 30, burn gel 1; we use one Antiseptic Wipes row with 30 and Burn Gel 1)
  ('OSHA Food Service/Restaurant First Aid Kit', 'Sterile Gauze Pads 4x4', 24),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Sterile Gauze Pads 8x10', 6),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 75),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Gauze Roll', 2),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Triangular Bandage', 6),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Antiseptic Wipes', 45),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Scissors', 1),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Tweezers', 1),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Emergency Blanket', 1),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Medical Tape', 2),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Disposable Gloves', 6),
  ('OSHA Food Service/Restaurant First Aid Kit', 'CPR Face Shield', 1),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Eye Wash Solution', 1),
  ('OSHA Food Service/Restaurant First Aid Kit', 'Burn Gel', 1),
  ('OSHA Food Service/Restaurant First Aid Kit', 'First Aid Guide', 1),
  -- OSHA Warehouse (no tourniquet in script)
  ('OSHA Warehouse/Logistics First Aid Kit', 'Sterile Gauze Pads 4x4', 40),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Sterile Gauze Pads 8x10', 10),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 150),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Gauze Roll', 3),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Triangular Bandage', 10),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Antiseptic Wipes', 25),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Scissors', 2),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Tweezers', 2),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Emergency Blanket', 3),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Medical Tape', 3),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Disposable Gloves', 8),
  ('OSHA Warehouse/Logistics First Aid Kit', 'CPR Face Shield', 2),
  ('OSHA Warehouse/Logistics First Aid Kit', 'Elastic Bandage', 4),
  ('OSHA Warehouse/Logistics First Aid Kit', 'SAM Splint', 2),
  ('OSHA Warehouse/Logistics First Aid Kit', 'First Aid Guide', 1),
  -- OSHA Manufacturing
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Sterile Gauze Pads 4x4', 40),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Sterile Gauze Pads 8x10', 10),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Adhesive Bandages - Assorted Sizes', 150),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Gauze Roll', 3),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Triangular Bandage', 10),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Antiseptic Wipes', 25),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Scissors', 2),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Tweezers', 2),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Emergency Blanket', 3),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Medical Tape', 3),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Disposable Gloves', 8),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'CPR Face Shield', 2),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Eye Wash Solution', 2),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Elastic Bandage', 4),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'SAM Splint', 2),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'Tourniquet', 1),
  ('OSHA Manufacturing/Industrial First Aid Kit', 'First Aid Guide', 1)
) AS v(tpl_name, supply_name, qty)
JOIN tpls t ON t.name = v.tpl_name
JOIN revs r ON r.kit_template_id = t.id
CROSS JOIN LATERAL (SELECT id FROM supplies WHERE name = v.supply_name AND scope = 'global' LIMIT 1) s;
