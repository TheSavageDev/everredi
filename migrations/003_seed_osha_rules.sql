-- =========================
-- Seed OSHA Compliance Rules
-- =========================
-- Seeds common OSHA compliance rules for Class A, Class B, and industry-specific kits

-- Note: This seed data uses placeholder supply IDs. In production, these should
-- be replaced with actual supply IDs from the supplies catalog.

-- =========================
-- Class A First Aid Kit (ANSI Z308.1-2021)
-- =========================
INSERT INTO osha_compliance_rules (
  industry,
  rule_name,
  description,
  required_supplies,
  group_size_min,
  is_active
) VALUES (
  'class_a',
  'ANSI Z308.1-2021 Class A',
  'Basic first aid kit for low-risk environments with smaller workforces. Addresses common workplace injuries like cuts, burns, and sprains.',
  '[
    {"supplyId": "placeholder-gauze-4x4", "supplyName": "Gauze pads (4x4 inches)", "quantity": 16, "supplyType": "bandage"},
    {"supplyId": "placeholder-gauze-8x10", "supplyName": "Gauze pads (8x10 inches)", "quantity": 4, "supplyType": "bandage"},
    {"supplyId": "placeholder-adhesive-bandages", "supplyName": "Adhesive bandages", "quantity": 50, "supplyType": "bandage"},
    {"supplyId": "placeholder-roller-bandage-2in", "supplyName": "Gauze roller bandage (2 inches wide)", "quantity": 1, "supplyType": "bandage"},
    {"supplyId": "placeholder-triangular-bandage", "supplyName": "Triangular bandages", "quantity": 4, "supplyType": "bandage"},
    {"supplyId": "placeholder-wound-cleaner", "supplyName": "Wound cleaning agent", "quantity": 10, "supplyType": "antiseptic"},
    {"supplyId": "placeholder-scissors", "supplyName": "Scissors", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-tweezers", "supplyName": "Tweezers", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-foil-blanket", "supplyName": "Foil blanket", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-adhesive-tape", "supplyName": "Adhesive tape", "quantity": 1, "supplyType": "bandage"},
    {"supplyId": "placeholder-latex-gloves", "supplyName": "Latex gloves", "quantity": 2, "supplyType": "protective"},
    {"supplyId": "placeholder-resuscitation-equipment", "supplyName": "Resuscitation equipment", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-emergency-directions", "supplyName": "Emergency assistance directions", "quantity": 1, "supplyType": "documentation"}
  ]'::jsonb,
  1,
  true
) ON CONFLICT DO NOTHING;

-- =========================
-- Class B First Aid Kit (ANSI Z308.1-2021)
-- =========================
INSERT INTO osha_compliance_rules (
  industry,
  rule_name,
  description,
  required_supplies,
  group_size_min,
  is_active
) VALUES (
  'class_b',
  'ANSI Z308.1-2021 Class B',
  'Comprehensive first aid kit for high-risk environments or larger operations. Contains all Class A supplies plus additional items for more severe injuries.',
  '[
    {"supplyId": "placeholder-gauze-4x4", "supplyName": "Gauze pads (4x4 inches)", "quantity": 32, "supplyType": "bandage"},
    {"supplyId": "placeholder-gauze-8x10", "supplyName": "Gauze pads (8x10 inches)", "quantity": 8, "supplyType": "bandage"},
    {"supplyId": "placeholder-adhesive-bandages", "supplyName": "Adhesive bandages", "quantity": 100, "supplyType": "bandage"},
    {"supplyId": "placeholder-roller-bandage-2in", "supplyName": "Gauze roller bandage (2 inches wide)", "quantity": 2, "supplyType": "bandage"},
    {"supplyId": "placeholder-triangular-bandage", "supplyName": "Triangular bandages", "quantity": 8, "supplyType": "bandage"},
    {"supplyId": "placeholder-wound-cleaner", "supplyName": "Wound cleaning agent", "quantity": 20, "supplyType": "antiseptic"},
    {"supplyId": "placeholder-scissors", "supplyName": "Scissors", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-tweezers", "supplyName": "Tweezers", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-foil-blanket", "supplyName": "Foil blanket", "quantity": 2, "supplyType": "emergency"},
    {"supplyId": "placeholder-adhesive-tape", "supplyName": "Adhesive tape", "quantity": 2, "supplyType": "bandage"},
    {"supplyId": "placeholder-latex-gloves", "supplyName": "Latex gloves", "quantity": 4, "supplyType": "protective"},
    {"supplyId": "placeholder-resuscitation-equipment", "supplyName": "Resuscitation equipment", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-elastic-wraps", "supplyName": "Elastic wraps", "quantity": 2, "supplyType": "bandage"},
    {"supplyId": "placeholder-splint", "supplyName": "Splint", "quantity": 1, "supplyType": "immobilization"},
    {"supplyId": "placeholder-tourniquet", "supplyName": "Tourniquet", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-emergency-directions", "supplyName": "Emergency assistance directions", "quantity": 1, "supplyType": "documentation"}
  ]'::jsonb,
  1,
  true
) ON CONFLICT DO NOTHING;

-- =========================
-- Construction Industry First Aid Kit
-- =========================
INSERT INTO osha_compliance_rules (
  industry,
  rule_name,
  description,
  required_supplies,
  group_size_min,
  environment,
  is_active
) VALUES (
  'construction',
  'OSHA Construction Industry First Aid',
  'First aid kit requirements for construction sites. Based on OSHA 1926.50 and ANSI Z308.1-2021 Class B with construction-specific additions.',
  '[
    {"supplyId": "placeholder-gauze-4x4", "supplyName": "Gauze pads (4x4 inches)", "quantity": 32, "supplyType": "bandage"},
    {"supplyId": "placeholder-gauze-8x10", "supplyName": "Gauze pads (8x10 inches)", "quantity": 8, "supplyType": "bandage"},
    {"supplyId": "placeholder-adhesive-bandages", "supplyName": "Adhesive bandages", "quantity": 100, "supplyType": "bandage"},
    {"supplyId": "placeholder-roller-bandage-2in", "supplyName": "Gauze roller bandage (2 inches wide)", "quantity": 2, "supplyType": "bandage"},
    {"supplyId": "placeholder-triangular-bandage", "supplyName": "Triangular bandages", "quantity": 8, "supplyType": "bandage"},
    {"supplyId": "placeholder-wound-cleaner", "supplyName": "Wound cleaning agent", "quantity": 20, "supplyType": "antiseptic"},
    {"supplyId": "placeholder-scissors", "supplyName": "Scissors", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-tweezers", "supplyName": "Tweezers", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-foil-blanket", "supplyName": "Foil blanket", "quantity": 2, "supplyType": "emergency"},
    {"supplyId": "placeholder-adhesive-tape", "supplyName": "Adhesive tape", "quantity": 2, "supplyType": "bandage"},
    {"supplyId": "placeholder-latex-gloves", "supplyName": "Latex gloves", "quantity": 4, "supplyType": "protective"},
    {"supplyId": "placeholder-resuscitation-equipment", "supplyName": "Resuscitation equipment", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-elastic-wraps", "supplyName": "Elastic wraps", "quantity": 2, "supplyType": "bandage"},
    {"supplyId": "placeholder-splint", "supplyName": "Splint", "quantity": 1, "supplyType": "immobilization"},
    {"supplyId": "placeholder-tourniquet", "supplyName": "Tourniquet", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-eye-wash", "supplyName": "Eye wash solution", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-emergency-directions", "supplyName": "Emergency assistance directions", "quantity": 1, "supplyType": "documentation"}
  ]'::jsonb,
  1,
  'construction',
  true
) ON CONFLICT DO NOTHING;

-- =========================
-- General Industry First Aid Kit
-- =========================
INSERT INTO osha_compliance_rules (
  industry,
  rule_name,
  description,
  required_supplies,
  group_size_min,
  environment,
  is_active
) VALUES (
  'general',
  'OSHA General Industry First Aid',
  'First aid kit requirements for general industry workplaces. Based on OSHA 1910.151 and ANSI Z308.1-2021.',
  '[
    {"supplyId": "placeholder-gauze-4x4", "supplyName": "Gauze pads (4x4 inches)", "quantity": 16, "supplyType": "bandage"},
    {"supplyId": "placeholder-gauze-8x10", "supplyName": "Gauze pads (8x10 inches)", "quantity": 4, "supplyType": "bandage"},
    {"supplyId": "placeholder-adhesive-bandages", "supplyName": "Adhesive bandages", "quantity": 50, "supplyType": "bandage"},
    {"supplyId": "placeholder-roller-bandage-2in", "supplyName": "Gauze roller bandage (2 inches wide)", "quantity": 1, "supplyType": "bandage"},
    {"supplyId": "placeholder-triangular-bandage", "supplyName": "Triangular bandages", "quantity": 4, "supplyType": "bandage"},
    {"supplyId": "placeholder-wound-cleaner", "supplyName": "Wound cleaning agent", "quantity": 10, "supplyType": "antiseptic"},
    {"supplyId": "placeholder-scissors", "supplyName": "Scissors", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-tweezers", "supplyName": "Tweezers", "quantity": 1, "supplyType": "tool"},
    {"supplyId": "placeholder-foil-blanket", "supplyName": "Foil blanket", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-adhesive-tape", "supplyName": "Adhesive tape", "quantity": 1, "supplyType": "bandage"},
    {"supplyId": "placeholder-latex-gloves", "supplyName": "Latex gloves", "quantity": 2, "supplyType": "protective"},
    {"supplyId": "placeholder-resuscitation-equipment", "supplyName": "Resuscitation equipment", "quantity": 1, "supplyType": "emergency"},
    {"supplyId": "placeholder-emergency-directions", "supplyName": "Emergency assistance directions", "quantity": 1, "supplyType": "documentation"}
  ]'::jsonb,
  1,
  'general',
  true
) ON CONFLICT DO NOTHING;
