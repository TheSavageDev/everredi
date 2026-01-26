-- =========================
-- Supply Catalog Seed Data
-- =========================
-- This seed file populates the supply catalog with common first aid supplies
-- Run this after 000_consolidated_schema.sql for new installations

-- =========================
-- Supply Categories
-- =========================

-- Insert global supply categories
-- Using fixed UUIDs for categories so we can reference them in supplies
INSERT INTO supply_categories (id, name, description, icon_name, sort_order, scope, tenant_id, created_at, updated_at)
VALUES
  -- Bandages & Wound Care
  ('a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', 'Adhesive bandages, gauze, tape, and wound dressing supplies', 'bandage', 1, 'global', NULL, NOW(), NOW()),
  
  -- Medications & Ointments
  ('b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', 'Pain relievers, antiseptics, antibiotic ointments, and other medications', 'medication', 2, 'global', NULL, NOW(), NOW()),
  
  -- Tools & Instruments
  ('c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', 'Scissors, tweezers, thermometers, and other medical tools', 'scissors', 3, 'global', NULL, NOW(), NOW()),
  
  -- Emergency & Trauma
  ('d4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', 'Tourniquets, splints, emergency blankets, and trauma supplies', 'emergency', 4, 'global', NULL, NOW(), NOW()),
  
  -- Personal Protection
  ('e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', 'Gloves, masks, eye protection, and other PPE', 'gloves', 5, 'global', NULL, NOW(), NOW()),
  
  -- Hygiene & Sanitation
  ('f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', 'Hand sanitizer, soap, wipes, and cleaning supplies', 'sanitizer', 6, 'global', NULL, NOW(), NOW()),
  
  -- Burn Care
  ('a7b8c9d0-e1f2-4345-a678-901234567890', 'Burn Care', 'Burn gel, burn dressings, and burn treatment supplies', 'burn', 7, 'global', NULL, NOW(), NOW()),
  
  -- Cold & Heat Therapy
  ('b8c9d0e1-f2a3-4456-b789-012345678901', 'Cold & Heat Therapy', 'Ice packs, heat packs, and thermal therapy supplies', 'ice-pack', 8, 'global', NULL, NOW(), NOW()),
  
  -- Respiratory
  ('c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', 'CPR masks, breathing barriers, and respiratory supplies', 'respiratory', 9, 'global', NULL, NOW(), NOW()),
  
  -- Documentation & Reference
  ('d0e1f2a3-b4c5-4678-d901-234567890123', 'Documentation & Reference', 'First aid guides, medical forms, and documentation supplies', 'documentation', 10, 'global', NULL, NOW(), NOW()),
  
  -- Monitoring & Diagnostics
  ('e1f2a3b4-c5d6-4789-e012-345678901234', 'Monitoring & Diagnostics', 'Blood glucose monitors, test strips, and diagnostic equipment', 'monitor', 11, 'global', NULL, NOW(), NOW()),
  
  -- IV & Drug Delivery
  ('f2a3b4c5-d6e7-4890-f123-456789012345', 'IV & Drug Delivery', 'Intravenous supplies and medication delivery equipment', 'syringe', 12, 'global', NULL, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =========================
-- Supplies
-- =========================

-- Bandages & Wound Care Supplies
INSERT INTO supplies (name, description, category_id, category_name, brand, unit_type, base_unit, expires, default_expiration_days, osha_required, scope, tenant_id, created_at, updated_at)
VALUES
  ('Adhesive Bandages', 'Standard adhesive bandages in various sizes (small, medium, large)', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'box', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Adhesive Bandages - Assorted Sizes', 'Standard adhesive bandages in various sizes (small, medium, large)', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'box', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Gauze Pads', 'Sterile gauze pads for wound dressing', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Sterile Gauze Pads 2x2', 'Sterile gauze pads for wound dressing, 2x2 inches', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Sterile Gauze Pads 3x4', 'Sterile gauze pads for wound dressing, 3x4 inches', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Sterile Gauze Pads 4x4', 'Sterile gauze pads for wound dressing, 4x4 inches', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Adhesive Bandages 2x4', 'Adhesive bandages, 2 inches by 4 inches', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'box', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Adhesive Bandages 3x4', 'Adhesive bandages, 3 inches by 4 inches', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'box', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Adhesive Bandages 4x4', 'Adhesive bandages, 4 inches by 4 inches', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'box', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Medical Tape', 'Hypoallergenic medical tape for securing dressings', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Elastic Bandage', 'Elastic wrap bandage for compression and support', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Moleskin', 'Adhesive padding for preventing and treating blisters', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Butterfly Closures', 'Adhesive strips for closing small wounds', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Non-Adherent Dressing', 'Non-stick wound dressing pads', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Hydrocolloid Dressing', 'Advanced wound dressing for moist wound healing', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('SuperSkin® Assorted Bandage', 'Waterproof adhesive bandages in assorted sizes', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('SuperSkin® Large Bandage', 'Large waterproof adhesive bandage', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('SuperSkin® Blister Tape', 'Waterproof tape for blister prevention and treatment', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Pressure Bandage', 'Emergency pressure bandage for controlling bleeding', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Israeli Emergency Bandage', 'Multi-purpose emergency bandage with pressure bar', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('OLAES® Modular Bandages', 'Modular bandage system for various wound sizes', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Compressed Gauze', 'Compressed gauze for wound packing and dressing', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Elastic Bandage with Self-Closure', 'Elastic bandage with self-adhesive closure', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Liquid Skin', 'Liquid bandage for wound closure and protection', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Super Wrap™', 'Self-adhering elastic wrap bandage', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Super Wash™', 'Antiseptic wound wash solution', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Waterproof Tape', 'Waterproof adhesive tape for securing dressings', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Triangular Bandage', 'Triangular cloth bandage for slings and large wound dressings', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Abdominal Pad (ABD Pad)', 'Large absorbent pad for abdominal wounds and heavy drainage', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Impregnated Gauze', 'Gauze impregnated with petroleum or other agents for wound care', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Foam Dressing', 'Advanced foam wound dressing for moderate to heavy exudate', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Alginate Dressing', 'Alginate fiber dressing for heavily draining wounds', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Hydrogel Dressing', 'Hydrogel wound dressing for dry or necrotic wounds', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Transparent Film Dressing', 'Transparent adhesive film for protecting wounds', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Collagen Dressing', 'Collagen-based wound dressing for chronic wounds', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Cohesive Bandage (Coban)', 'Self-adhering elastic bandage that sticks to itself', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Compression Bandage', 'Elastic compression bandage for sprains and swelling', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Finger Bandage', 'Specialized bandage for finger injuries', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Knuckle Bandage', 'Specialized bandage for knuckle and joint injuries', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Waterproof Adhesive Bandage', 'Waterproof adhesive bandage for showering and swimming', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'box', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Transparent Surgical Tape', 'Clear adhesive tape for securing dressings', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Cloth Surgical Tape', 'Cloth-backed adhesive tape for secure dressing attachment', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Paper Surgical Tape', 'Gentle paper tape for sensitive skin', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Sports Tape', 'Heavy-duty athletic tape for sports injuries', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Athletic Tape', 'Rigid athletic tape for joint support and injury prevention', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Pre-wrap', 'Foam underwrap for athletic tape to protect skin', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Kinesiology Tape', 'Elastic therapeutic tape for muscle and joint support', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Foam Padding', 'Protective foam padding for injury prevention and comfort', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Heel and Lace Pads', 'Protective pads for heel and lace areas to prevent blisters', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Gauze Roll', 'Rolled gauze for wrapping and securing dressings', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Gauze Sponges', 'Non-woven gauze sponges for wound cleaning and dressing', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Sterile Gauze Roll', 'Sterile rolled gauze for wound wrapping', 'a1b2c3d4-e5f6-4789-a012-345678901234', 'Bandages & Wound Care', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),

-- Medications & Ointments
  ('Antibiotic Ointment', 'Triple antibiotic ointment for preventing infection', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'tube', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Hydrocortisone Cream', 'Topical steroid cream for itching and inflammation', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'tube', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Antiseptic Solution', 'Antiseptic solution for cleaning wounds', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Antiseptic Wipes', 'Disposable antiseptic wipes for cleaning wounds', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Pain Relievers', 'Non-prescription pain reliever tablets', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Antihistamine', 'Oral antihistamine for allergic reactions', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Hydrogen Peroxide', 'Antiseptic solution for wound cleaning', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Pain Reliever - Ibuprofen', 'Non-prescription pain reliever and anti-inflammatory', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Pain Reliever - Acetaminophen', 'Non-prescription pain reliever and fever reducer', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Antihistamine Tablets', 'Oral antihistamine for allergic reactions', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Aspirin', 'Low-dose aspirin for heart attack prevention', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Ibuprofen Sachet', 'Single-serve packet of ibuprofen pain reliever and anti-inflammatory', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Acetaminophen Sachet', 'Single-serve packet of acetaminophen pain reliever and fever reducer', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Aspirin Sachet', 'Single-serve packet of aspirin for pain relief and heart attack prevention', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Antihistamine Sachet', 'Single-serve packet of antihistamine for allergic reactions', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Eye Drops', 'Lubricating eye drops for eye irritation', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 365, false, 'global', NULL, NOW(), NOW()),
  ('Transcend® Glucose Gel', 'Glucose gel for treating hypoglycemia', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'pack', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Wound Cleanser', 'Specialized wound cleansing solution for irrigation', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Saline Solution', 'Sterile saline solution for wound irrigation', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Povidone-Iodine Solution', 'Antiseptic solution for wound disinfection', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Chlorhexidine Solution', 'Antiseptic solution for skin disinfection', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Silver Sulfadiazine Cream', 'Antibacterial cream for burn treatment', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'tube', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Lidocaine Gel', 'Topical anesthetic gel for pain relief', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'tube', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Benzocaine Topical', 'Topical anesthetic for minor pain relief', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'tube', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Calamine Lotion', 'Topical lotion for itching and skin irritation', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Biofreeze', 'Topical pain relief gel for muscle aches and soreness', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Icy Hot', 'Topical pain relief cream with cooling and heating effects', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'tube', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Tiger Balm', 'Topical analgesic ointment for muscle pain relief', 'b2c3d4e5-f6a7-4890-b123-456789012345', 'Medications & Ointments', NULL, 'tube', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),

-- Tools & Instruments
  ('Medical Scissors', 'Stainless steel medical scissors for cutting bandages and clothing', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Scissors', 'Medical scissors for cutting bandages and materials', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Tweezers', 'Fine-point tweezers for removing splinters and debris', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Digital Thermometer', 'Digital thermometer for measuring body temperature', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Thermometer', 'Digital thermometer for measuring body temperature', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Digital Thermometer', 'Digital thermometer for measuring body temperature', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Instant Cold Pack', 'Single-use instant cold pack for reducing swelling', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Instant Heat Pack', 'Single-use instant heat pack for muscle pain relief', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Safety Pins', 'Stainless steel safety pins for securing bandages', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Splinter Remover', 'Sterile splinter removal tool', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Flashlight', 'Compact LED flashlight for examining wounds in low light', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('EMT Shears', 'Emergency medical technician shears for cutting', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('XShear Trauma Shears', 'Heavy-duty trauma shears for emergency use', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Lighted Tweezer', 'Tweezer with built-in LED light for visibility', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('PenBlade', 'Compact pen-style utility blade', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Hemostat Curved 5.5"', 'Curved hemostat forceps for clamping and grasping', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Hemostat Straight 5.5"', 'Straight hemostat forceps for clamping and grasping', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Surgical Scalpel Blade', 'Disposable surgical scalpel blade', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Surgical Scalpel Handle', 'Reusable surgical scalpel handle', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Needle Holder Smooth Jaw', 'Surgical needle holder with smooth jaws', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Suture Removal Kit', 'Kit for removing surgical sutures', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Staple Removal Kit', 'Kit for removing surgical staples', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Sharp/Blunt Tip Scissor', 'Scissors with one sharp and one blunt tip', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('LEATHERMAN® Raptor®', 'Multi-tool with medical shears and features', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('LEATHERMAN® Skeletool® RX', 'Compact multi-tool with medical features', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Sharps Container Large', 'Large container for safe disposal of sharps', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Stainless Steel Scissors', 'Stainless steel medical scissors', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Paracord', 'Parachute cord for emergency use and survival', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'roll', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Whistle', 'Emergency whistle for signaling', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Firebiner', 'Survival carabiner with fire starter', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Lightstick', 'Chemical light stick for emergency lighting', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Blood Pressure Cuff', 'Manual blood pressure monitoring device', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Stethoscope', 'Medical stethoscope for auscultation', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Pulse Oximeter', 'Device for measuring blood oxygen saturation', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Penlight', 'Small pen-sized flashlight for pupil examination', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Tongue Depressor', 'Disposable wooden tongue depressor for oral examination', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Cotton Swabs', 'Sterile cotton swabs for wound cleaning and application', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Irrigation Syringe', 'Syringe for wound irrigation and cleaning', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Forceps', 'Medical forceps for removing debris and splinters', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Athletic Trainer Scissors', 'Specialized scissors for cutting athletic tape and bandages', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),

-- Generic Survival Tools
  ('Headlamp', 'LED headlamp with adjustable strap for hands-free lighting', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Hand-crank Flashlight', 'Emergency flashlight that doesn''t require batteries, powered by hand crank', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Radio', 'Hand-crank emergency radio with weather alerts and AM/FM reception', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('NOAA Radio', 'NOAA Weather Radio for receiving weather alerts and emergency broadcasts', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('GPS Device', 'Portable GPS device for navigation and location tracking', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Beacon', 'Personal Locator Beacon (PLB) for emergency rescue signaling', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Two-way Radio', 'Portable two-way radio for communication and coordination', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Power Bank', 'Portable battery pack for charging electronic devices', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Solar Charger', 'Portable solar panel for charging electronic devices', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Candle', 'Long-burning emergency candle for light and warmth', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Fire Starter', 'Ferrocerium rod for starting fires in emergency situations', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Waterproof Matches', 'Waterproof emergency matches for fire starting', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Matches', 'Strike-anywhere emergency matches for fire starting', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Lighter', 'Disposable butane lighter for fire starting', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Multi-tool', 'Generic multi-tool with pliers, knife, screwdrivers, and other tools', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Survival Knife', 'Fixed-blade survival knife for cutting and utility tasks', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Folding Knife', 'Compact folding knife for everyday carry and utility tasks', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Saw', 'Compact wire saw for cutting wood and branches', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Hatchet', 'Compact emergency hatchet for chopping and splitting wood', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Shovel', 'Folding emergency shovel for digging and excavation', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Compass', 'Baseplate compass for navigation and orientation', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Signal Mirror', 'Emergency signaling mirror for attracting attention and rescue', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Water Purification Tablets', 'Chemical water purification tablets for making water safe to drink', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Water Filter', 'Portable water filtration system for purifying water', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Water Bottle', 'Durable water container for storing and carrying water', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Food', 'Long-shelf-life emergency rations for survival situations', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Tarp', 'Lightweight emergency shelter tarp for protection from elements', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Poncho', 'Waterproof emergency poncho for rain protection', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Duct Tape', 'Heavy-duty duct tape for repairs and emergency fixes', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'roll', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Zip Ties', 'Heavy-duty cable ties for securing and fastening', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Carabiner', 'D-ring carabiner for gear attachment and securing equipment', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Paracord Bracelet', 'Woven paracord bracelet that can be unwound for emergency cordage', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Sewing Kit', 'Compact sewing kit with needle, thread, and patches for repairs', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Fishing Kit', 'Compact fishing kit with line, hooks, and lures for catching food', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emergency Repair Kit', 'Multi-purpose repair kit with patches, adhesives, and repair materials', 'c3d4e5f6-a7b8-4901-c234-567890123456', 'Tools & Instruments', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),

-- Emergency & Trauma
  ('Tourniquet', 'Emergency tourniquet for controlling severe bleeding', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('Emergency Blanket', 'Mylar emergency blanket for warmth and shock prevention', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('SAM Splint', 'Moldable splint for immobilizing fractures', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Chest Seal', 'Occlusive dressing for treating open chest wounds', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Hemostatic Gauze', 'Advanced hemostatic dressing for severe bleeding', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Trauma Shears', 'Heavy-duty scissors for cutting clothing and materials', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('RATS Tourniquet', 'Rapid application tourniquet system', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('SOF® Tactical Tourniquet', 'Special operations forces tactical tourniquet', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('CAT Tourniquet', 'Combat application tourniquet', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('SAM XT Tourniquet', 'SAM extreme tourniquet for severe bleeding control', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('K-9 Tourniquet', 'Tourniquet designed for canine use', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('T-Ring Digit Tourniquet', 'Tourniquet for finger and digit injuries', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('QuikClot®', 'Hemostatic agent for rapid bleeding control', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('QuikClot® Combat Gauze LE', 'Law enforcement hemostatic gauze', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Decompression Needle', 'Needle for tension pneumothorax decompression', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Stay Alive Guide', 'First aid and survival reference guide', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Survival Rescue Blanket', 'Emergency survival blanket for warmth and signaling', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Super Bivvy', 'Emergency bivvy sack for shelter and warmth', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Wool Blanket', 'Wool emergency blanket for warmth', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Finger Splint Pro', 'Professional finger splint for fracture immobilization', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Finger Splint', 'Rigid splint for finger fracture immobilization', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Arm Sling', 'Fabric sling for arm and shoulder support', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Cervical Collar', 'Neck brace for cervical spine immobilization', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Spine Board', 'Rigid backboard for full body immobilization', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Kendrick Extrication Device', 'Spine immobilization device for vehicle extrication', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Nasal Airway', 'Nasopharyngeal airway for maintaining nasal breathing', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Oral Airway', 'Oropharyngeal airway for maintaining oral breathing', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Suction Catheter', 'Catheter for airway suctioning', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Manual Suction Device', 'Manual suction device for airway management', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Pressure Bandage', 'Elastic pressure bandage for controlling bleeding', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Israeli Bandage', 'Multi-purpose pressure bandage for trauma', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Ankle Brace', 'Supportive ankle brace for injury prevention and recovery', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Knee Brace', 'Supportive knee brace for injury prevention and recovery', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Wrist Brace', 'Supportive wrist brace for injury prevention and recovery', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Elbow Brace', 'Supportive elbow brace for injury prevention and recovery', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Shoulder Brace', 'Supportive shoulder brace for injury prevention and recovery', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Compression Sleeve', 'Elastic compression sleeve for muscle support and recovery', 'd4e5f6a7-b8c9-4012-d345-678901234567', 'Emergency & Trauma', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),

-- Personal Protection
  ('Nitrile Gloves', 'Disposable nitrile gloves for protection', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'box', 'pair', true, 1825, true, 'global', NULL, NOW(), NOW()),
  ('Disposable Gloves', 'Disposable gloves for protection', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'box', 'pair', true, 1825, true, 'global', NULL, NOW(), NOW()),
  ('Face Masks', 'Disposable face masks for respiratory protection', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Safety Goggles', 'Protective eyewear for eye protection', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'piece', 'each', false, NULL, true, 'global', NULL, NOW(), NOW()),
  ('Face Shield', 'Disposable face shield for full face protection', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('CPR Face Shield', 'Barrier device for performing CPR safely', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('CPR Shield Single', 'Single-use CPR barrier shield', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('N95 Respirator', 'N95 filtering facepiece respirator for airborne protection', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Surgical Mask', 'Disposable surgical mask for droplet protection', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Gown', 'Disposable isolation gown for infection control', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Shoe Covers', 'Disposable shoe covers for infection control', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Bouffant Cap', 'Disposable head covering for infection control', 'e5f6a7b8-c9d0-4123-e456-789012345678', 'Personal Protection', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),

-- Hygiene & Sanitation
  ('Hand Sanitizer', 'Alcohol-based hand sanitizer gel', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Antibacterial Wipes', 'Disposable antibacterial cleaning wipes', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'pack', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Eye Wash Solution', 'Sterile eye wash solution for eye irrigation', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Soap', 'Antibacterial hand soap', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Disinfectant Spray', 'Surface disinfectant spray', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Hand Sanitizer Wipes', 'Disposable hand sanitizer wipes', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'pack', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Surface Disinfectant Wipes', 'Disposable wipes for surface disinfection', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'pack', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Isopropyl Alcohol', 'Isopropyl alcohol for disinfection', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'bottle', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),
  ('Chlorhexidine Wipes', 'Antiseptic wipes for skin preparation', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'pack', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Alcohol Prep Pad', 'Disposable alcohol prep pad for injection site cleaning', 'f6a7b8c9-d0e1-4234-f567-890123456789', 'Hygiene & Sanitation', NULL, 'pack', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),

-- Burn Care
  ('Burn Gel', 'Cooling gel for treating minor burns', 'a7b8c9d0-e1f2-4345-a678-901234567890', 'Burn Care', NULL, 'tube', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Burn Dressing', 'Specialized dressing for burn wounds', 'a7b8c9d0-e1f2-4345-a678-901234567890', 'Burn Care', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Aloe Vera Gel', 'Natural aloe vera gel for soothing burns', 'a7b8c9d0-e1f2-4345-a678-901234567890', 'Burn Care', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),
  ('Burn Pump Spray', 'Pump spray for burn treatment', 'a7b8c9d0-e1f2-4345-a678-901234567890', 'Burn Care', NULL, 'bottle', 'each', true, 730, false, 'global', NULL, NOW(), NOW()),

-- Cold & Heat Therapy
  ('Reusable Cold Pack', 'Reusable gel cold pack for reducing swelling', 'b8c9d0e1-f2a3-4456-b789-012345678901', 'Cold & Heat Therapy', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Reusable Heat Pack', 'Reusable gel heat pack for muscle pain relief', 'b8c9d0e1-f2a3-4456-b789-012345678901', 'Cold & Heat Therapy', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Ice Pack', 'Instant or reusable cold pack for reducing swelling', 'b8c9d0e1-f2a3-4456-b789-012345678901', 'Cold & Heat Therapy', NULL, 'pack', 'each', true, 1095, false, 'global', NULL, NOW(), NOW()),

-- Respiratory
  ('CPR Pocket Mask', 'Compact CPR mask with one-way valve', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Bag Valve Mask', 'Manual resuscitation device for advanced first aid', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('CPR Face Shield', 'Barrier device for performing CPR safely', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Oral Airway Kit', 'Complete oral airway kit with multiple sizes', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Nasal Cannula', 'Oxygen delivery device for nasal administration', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Simple Face Mask', 'Basic oxygen mask for oxygen delivery', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Non-Rebreather Mask', 'High-concentration oxygen mask with reservoir bag', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Venturi Mask', 'Oxygen mask with precise concentration control', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Nebulizer', 'Device for delivering medication via aerosol', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Nebulizer Medication Cup', 'Disposable cup for nebulizer medication', 'c9d0e1f2-a3b4-4567-c890-123456789012', 'Respiratory', NULL, 'piece', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),

-- Documentation & Reference
  ('First Aid Guide', 'Pocket-sized first aid reference guide', 'd0e1f2a3-b4c5-4678-d901-234567890123', 'Documentation & Reference', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Medical Information Form', 'Form for documenting patient information', 'd0e1f2a3-b4c5-4678-d901-234567890123', 'Documentation & Reference', NULL, 'pack', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Permanent Marker', 'Waterproof marker for marking bandages and documentation', 'd0e1f2a3-b4c5-4678-d901-234567890123', 'Documentation & Reference', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Emesis Bag', 'Disposable emesis bag', 'd0e1f2a3-b4c5-4678-d901-234567890123', 'Documentation & Reference', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),

-- Monitoring & Diagnostics
  ('Blood Glucose Monitor', 'Device for measuring blood glucose levels', 'e1f2a3b4-c5d6-4789-e012-345678901234', 'Monitoring & Diagnostics', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),
  ('Blood Glucose Test Strips', 'Test strips for blood glucose monitoring', 'e1f2a3b4-c5d6-4789-e012-345678901234', 'Monitoring & Diagnostics', NULL, 'pack', 'each', true, 365, false, 'global', NULL, NOW(), NOW()),
  ('Lancets', 'Disposable lancets for blood glucose testing', 'e1f2a3b4-c5d6-4789-e012-345678901234', 'Monitoring & Diagnostics', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Lancing Device', 'Device for obtaining blood samples', 'e1f2a3b4-c5d6-4789-e012-345678901234', 'Monitoring & Diagnostics', NULL, 'piece', 'each', false, NULL, false, 'global', NULL, NOW(), NOW()),

-- IV & Drug Delivery
  ('Syringe', 'Disposable syringe for medication administration', 'f2a3b4c5-d6e7-4890-f123-456789012345', 'IV & Drug Delivery', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
  ('Needle', 'Disposable hypodermic needle', 'f2a3b4c5-d6e7-4890-f123-456789012345', 'IV & Drug Delivery', NULL, 'pack', 'each', true, 1825, false, 'global', NULL, NOW(), NOW()),
ON CONFLICT DO NOTHING;

-- =========================
-- Supply Variants (Optional Examples)
-- =========================

-- Add some common variants for supplies that have multiple sizes/packaging
-- Note: These use dynamic lookups, so they'll only work if the supplies were inserted successfully

-- Adhesive Bandages - different sizes
INSERT INTO supply_variants (supply_id, label, units_per_variant, created_at, updated_at)
SELECT 
  s.id,
  'Small (0.75" x 3")',
  1,
  NOW(),
  NOW()
FROM supplies s
WHERE s.name = 'Adhesive Bandages - Assorted Sizes' AND s.scope = 'global'
ON CONFLICT DO NOTHING;

INSERT INTO supply_variants (supply_id, label, units_per_variant, created_at, updated_at)
SELECT 
  s.id,
  'Medium (1" x 3")',
  1,
  NOW(),
  NOW()
FROM supplies s
WHERE s.name = 'Adhesive Bandages - Assorted Sizes' AND s.scope = 'global'
ON CONFLICT DO NOTHING;

INSERT INTO supply_variants (supply_id, label, units_per_variant, created_at, updated_at)
SELECT 
  s.id,
  'Large (2" x 4")',
  1,
  NOW(),
  NOW()
FROM supplies s
WHERE s.name = 'Adhesive Bandages - Assorted Sizes' AND s.scope = 'global'
ON CONFLICT DO NOTHING;

-- Nitrile Gloves - different sizes
INSERT INTO supply_variants (supply_id, label, units_per_variant, created_at, updated_at)
SELECT 
  s.id,
  'Small',
  1,
  NOW(),
  NOW()
FROM supplies s
WHERE s.name = 'Nitrile Gloves' AND s.scope = 'global'
ON CONFLICT DO NOTHING;

INSERT INTO supply_variants (supply_id, label, units_per_variant, created_at, updated_at)
SELECT 
  s.id,
  'Medium',
  1,
  NOW(),
  NOW()
FROM supplies s
WHERE s.name = 'Nitrile Gloves' AND s.scope = 'global'
ON CONFLICT DO NOTHING;

INSERT INTO supply_variants (supply_id, label, units_per_variant, created_at, updated_at)
SELECT 
  s.id,
  'Large',
  1,
  NOW(),
  NOW()
FROM supplies s
WHERE s.name = 'Nitrile Gloves' AND s.scope = 'global'
ON CONFLICT DO NOTHING;

INSERT INTO supply_variants (supply_id, label, units_per_variant, created_at, updated_at)
SELECT 
  s.id,
  'Extra Large',
  1,
  NOW(),
  NOW()
FROM supplies s
WHERE s.name = 'Nitrile Gloves' AND s.scope = 'global'
ON CONFLICT DO NOTHING;
