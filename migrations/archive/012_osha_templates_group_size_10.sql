-- Align OSHA templates with typical guidance: low-risk (Class A, general industry, food service) = 10;
-- high-risk (Class B, construction, healthcare, warehouse, manufacturing) = 25.

UPDATE kit_templates
SET
  group_size = 10,
  default_people_count = 10,
  people_count_options = ARRAY[1, 2, 4, 6, 8]
WHERE purpose IN ('osha-class-a', 'osha-general-industry', 'osha-food-service')
  AND (created_by = 'system' OR created_by IS NULL);

UPDATE kit_templates
SET
  group_size = 25,
  default_people_count = 25,
  people_count_options = ARRAY[1, 2, 4, 6, 8, 12]
WHERE purpose IN ('osha-class-b', 'osha-construction', 'osha-healthcare', 'osha-warehouse', 'osha-manufacturing')
  AND (created_by = 'system' OR created_by IS NULL);
