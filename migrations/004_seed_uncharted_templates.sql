-- =========================
-- Uncharted Supply Co premium kit templates seed
-- =========================
-- Seeds Uncharted public kit templates (requires_premium = true).
-- Same set as scripts/seed-uncharted-templates.ts. Run after 001 (and optionally 002, 003).
-- Supply names must exist in 001_seed_supply_catalog.sql (including Uncharted supplies block).

WITH tpls AS (
  INSERT INTO kit_templates (
    user_id, name, description, purpose, group_size, environment, skill_level,
    is_public, default_people_count, people_count_options, created_by, is_active, requires_premium,
    created_at, updated_at
  )
  VALUES
    (NULL, 'Uncharted Supply Co The Possibles Pouch', 'Uncharted Supply Co The Possibles Pouch. Includes all the supplies you need to treat minor injuries and emergencies.', 'uncharted', 4, 'outdoor', 'intermediate', true, 4, ARRAY[1, 2, 4], 'system', true, true, NOW(), NOW()),
    (NULL, 'Uncharted Supply Co First Aid Plus', 'Uncharted Supply Co First Aid Plus. Includes all the supplies you need to treat minor injuries and emergencies.', 'uncharted', 4, 'outdoor', 'intermediate', true, 4, ARRAY[1, 2, 4], 'system', true, true, NOW(), NOW()),
    (NULL, 'Uncharted Supply Co First Aid Pro', 'Uncharted Supply Co First Aid Pro. Includes all the supplies you need to treat minor injuries and emergencies.', 'uncharted', 4, 'outdoor', 'intermediate', true, 4, ARRAY[1, 2, 4], 'system', true, true, NOW(), NOW()),
    (NULL, 'Uncharted Supply Co Triage Kit', 'Uncharted Supply Co Triage Kit. Includes all the supplies you need to treat minor injuries and emergencies.', 'uncharted', 4, 'outdoor', 'intermediate', true, 4, ARRAY[1, 2, 4], 'system', true, true, NOW(), NOW()),
    (NULL, 'Uncharted Supply Co Core', 'Uncharted Supply Co Core. Includes all the supplies you need to treat minor injuries and emergencies.', 'uncharted', 4, 'outdoor', 'intermediate', true, 4, ARRAY[1, 2, 4], 'system', true, true, NOW(), NOW()),
    (NULL, 'Uncharted Supply Co The Wolf Pack', 'Uncharted Supply Co The Wolf Pack. Includes all the supplies you need to treat minor injuries and emergencies.', 'uncharted', 4, 'outdoor', 'intermediate', true, 4, ARRAY[1, 2, 4], 'system', true, true, NOW(), NOW())
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
  -- The Possibles Pouch
  ('Uncharted Supply Co The Possibles Pouch', 'Ibuprofen Sachet', 2),
  ('Uncharted Supply Co The Possibles Pouch', 'Antihistamine Sachet', 2),
  ('Uncharted Supply Co The Possibles Pouch', 'Adhesive bandages (1x3 inches)', 6),
  ('Uncharted Supply Co The Possibles Pouch', 'Adhesive bandages (2x4 inches)', 2),
  ('Uncharted Supply Co The Possibles Pouch', 'Mylar Blanket', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Blister Gels', 4),
  ('Uncharted Supply Co The Possibles Pouch', 'Triple Antibiotic', 4),
  ('Uncharted Supply Co The Possibles Pouch', 'Safety Pins', 2),
  ('Uncharted Supply Co The Possibles Pouch', 'Wound Closure Stripes', 2),
  ('Uncharted Supply Co The Possibles Pouch', 'Hemostatic gauze', 4),
  ('Uncharted Supply Co The Possibles Pouch', 'Gauze Pads (3x3 inches)', 2),
  ('Uncharted Supply Co The Possibles Pouch', 'Slishman Pressure Bandage', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Bailing Wire', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Flat Pack Duct Tape', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Flat Pack stormproof matches', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Reusable Zip Ties', 4),
  ('Uncharted Supply Co The Possibles Pouch', 'Signaling Mirror', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Fishing Kit', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Ferro Rod', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Tinder', 1),
  ('Uncharted Supply Co The Possibles Pouch', 'Water Purification Tablets', 5),
  -- First Aid Plus (Antibaterial Wipes -> Antiseptic Wipes)
  ('Uncharted Supply Co First Aid Plus', 'Adhesive bandages (2x4 inches)', 6),
  ('Uncharted Supply Co First Aid Plus', 'Hypo-allergenic Medical Tape', 1),
  ('Uncharted Supply Co First Aid Plus', 'Duct Tape', 1),
  ('Uncharted Supply Co First Aid Plus', 'Triangular Bandage', 1),
  ('Uncharted Supply Co First Aid Plus', 'Splinter Probes', 1),
  ('Uncharted Supply Co First Aid Plus', 'Shears', 1),
  ('Uncharted Supply Co First Aid Plus', 'Antiseptic Wipes', 1),
  ('Uncharted Supply Co First Aid Plus', 'Nitrile Gloves', 2),
  ('Uncharted Supply Co First Aid Plus', 'Flashlight', 1),
  ('Uncharted Supply Co First Aid Plus', 'Tweezers', 1),
  ('Uncharted Supply Co First Aid Plus', 'First Aid Guide & Notebook', 1),
  ('Uncharted Supply Co First Aid Plus', 'Adhesive bandages (1x3 inches)', 6),
  ('Uncharted Supply Co First Aid Plus', 'Chem Lights', 2),
  ('Uncharted Supply Co First Aid Plus', 'Mylar Blanket', 1),
  ('Uncharted Supply Co First Aid Plus', 'Stormproof Matches', 2),
  ('Uncharted Supply Co First Aid Plus', 'Non-Adhesive Cotton Gauze Sponges', 2),
  ('Uncharted Supply Co First Aid Plus', 'Triple Antibiotic', 5),
  ('Uncharted Supply Co First Aid Plus', 'Multi-tool Pro', 1),
  ('Uncharted Supply Co First Aid Plus', 'Safety Pins', 5),
  ('Uncharted Supply Co First Aid Plus', 'Slishman Pressure Bandage', 1),
  ('Uncharted Supply Co First Aid Plus', 'Zip Ties - 7 inches', 4),
  ('Uncharted Supply Co First Aid Plus', 'Burn Cream', 1),
  ('Uncharted Supply Co First Aid Plus', 'Blister Pads', 5),
  ('Uncharted Supply Co First Aid Plus', 'Saline Tube (30mL)', 1),
  ('Uncharted Supply Co First Aid Plus', 'Antiseptic Towelette', 1),
  ('Uncharted Supply Co First Aid Plus', 'CPR Kit', 1),
  -- First Aid Pro
  ('Uncharted Supply Co First Aid Pro', 'Shears', 1),
  ('Uncharted Supply Co First Aid Pro', 'Gauze Pads', 1),
  ('Uncharted Supply Co First Aid Pro', 'Triple Antibiotic', 1),
  ('Uncharted Supply Co First Aid Pro', 'Mylar Blanket', 1),
  ('Uncharted Supply Co First Aid Pro', 'First Aid Guide & Notebook', 1),
  ('Uncharted Supply Co First Aid Pro', 'Permanent Marker', 1),
  ('Uncharted Supply Co First Aid Pro', 'Splinter Probes', 4),
  ('Uncharted Supply Co First Aid Pro', 'Triangular Bandage', 1),
  ('Uncharted Supply Co First Aid Pro', 'Compressed Gauze', 2),
  ('Uncharted Supply Co First Aid Pro', 'Tweezers', 1),
  ('Uncharted Supply Co First Aid Pro', 'Burn Cream', 1),
  ('Uncharted Supply Co First Aid Pro', 'Blister Gels', 5),
  ('Uncharted Supply Co First Aid Pro', 'Slishman Pressure Bandage', 1),
  ('Uncharted Supply Co First Aid Pro', 'Adhesive bandages (1x3 inches)', 6),
  ('Uncharted Supply Co First Aid Pro', 'Wound Closure Stripes', 3),
  ('Uncharted Supply Co First Aid Pro', 'Antihistamine Sachet', 2),
  ('Uncharted Supply Co First Aid Pro', 'Nitrile Gloves', 1),
  ('Uncharted Supply Co First Aid Pro', 'Safety Pins', 6),
  ('Uncharted Supply Co First Aid Pro', 'Aspirin', 2),
  ('Uncharted Supply Co First Aid Pro', 'Hypo-allergenic Medical Tape', 1),
  ('Uncharted Supply Co First Aid Pro', 'Adhesive bandages (2x4 inches)', 5),
  ('Uncharted Supply Co First Aid Pro', 'Ibuprofen Sachet', 2),
  ('Uncharted Supply Co First Aid Pro', 'CPR Kit', 1),
  ('Uncharted Supply Co First Aid Pro', 'Saline Tube (30mL)', 1),
  -- Triage Kit
  ('Uncharted Supply Co Triage Kit', 'Stormproof Matches', 10),
  ('Uncharted Supply Co Triage Kit', 'Adhesive bandages (1x3 inches)', 6),
  ('Uncharted Supply Co Triage Kit', 'Blister Pads', 5),
  ('Uncharted Supply Co Triage Kit', 'Zip Ties - 7 inches', 4),
  ('Uncharted Supply Co Triage Kit', 'Adhesive bandages (2x4 inches)', 2),
  ('Uncharted Supply Co Triage Kit', 'Safety Pins', 3),
  ('Uncharted Supply Co Triage Kit', 'Aspirin', 2),
  ('Uncharted Supply Co Triage Kit', 'Lube Jelly', 4),
  ('Uncharted Supply Co Triage Kit', 'Wound Closure Stripes', 2),
  ('Uncharted Supply Co Triage Kit', 'Flat Pack Duct Tape', 1),
  ('Uncharted Supply Co Triage Kit', 'Bailing Wire', 1),
  ('Uncharted Supply Co Triage Kit', 'Carrying Pouch', 1),
  ('Uncharted Supply Co Triage Kit', 'Mylar Blanket', 1),
  -- Core
  ('Uncharted Supply Co Core', 'Nitrile Gloves', 2),
  ('Uncharted Supply Co Core', 'Shears', 1),
  ('Uncharted Supply Co Core', 'CPR Mask', 1),
  ('Uncharted Supply Co Core', 'Safety Pins', 2),
  ('Uncharted Supply Co Core', 'Non-Adhesive Cotton Gauze Sponges', 2),
  ('Uncharted Supply Co Core', 'Splinter Probes', 1),
  ('Uncharted Supply Co Core', 'Antiseptic Wipes', 3),
  ('Uncharted Supply Co Core', 'Tweezers', 1),
  ('Uncharted Supply Co Core', 'Conforming Bandage', 1),
  ('Uncharted Supply Co Core', 'Medical Tape', 1),
  ('Uncharted Supply Co Core', 'Adhesive bandages (2x4 inches)', 8),
  ('Uncharted Supply Co Core', 'Adhesive Bandages 4x4', 2),
  -- The Wolf Pack (Cohesive Bandage -> Cohesive Bandage (Coban))
  ('Uncharted Supply Co The Wolf Pack', 'Gauze Pads (3x3 inches)', 2),
  ('Uncharted Supply Co The Wolf Pack', 'Alcohol Wipes', 3),
  ('Uncharted Supply Co The Wolf Pack', 'Reusable Zip Ties', 2),
  ('Uncharted Supply Co The Wolf Pack', 'Nitrile Gloves', 1),
  ('Uncharted Supply Co The Wolf Pack', 'Forceps', 1),
  ('Uncharted Supply Co The Wolf Pack', 'Dog Waste Bags', 1),
  ('Uncharted Supply Co The Wolf Pack', 'Cohesive Bandage (Coban)', 1),
  ('Uncharted Supply Co The Wolf Pack', 'Triple Antibiotic', 1),
  ('Uncharted Supply Co The Wolf Pack', 'Hemostatic gauze', 2)
) AS v(tpl_name, supply_name, qty)
JOIN tpls t ON t.name = v.tpl_name
JOIN revs r ON r.kit_template_id = t.id
CROSS JOIN LATERAL (SELECT id FROM supplies WHERE name = v.supply_name AND scope = 'global' LIMIT 1) s;
