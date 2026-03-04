-- Backfill default_people_count and people_count_options from group_size.
-- Rule: default_people_count = group_size; people_count_options = [1,2,4,6,8,12] filtered to values < group_size.

UPDATE kit_templates
SET
  default_people_count = group_size,
  people_count_options = (
    SELECT COALESCE(array_agg(x ORDER BY x), '{}')
    FROM unnest(ARRAY[1, 2, 4, 6, 8, 12]) AS x
    WHERE x < kit_templates.group_size
  )
WHERE default_people_count IS DISTINCT FROM group_size
   OR people_count_options IS NULL;
