-- Consolidate kit_template_revisions RLS to one policy per operation (fixes "multiple permissive policies" WARN).
-- SELECT: owner or template is public. INSERT/UPDATE/DELETE: owner only.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revisions') THEN
    DROP POLICY IF EXISTS "kit_template_revisions_all" ON kit_template_revisions;
    DROP POLICY IF EXISTS "kit_template_revisions_select" ON kit_template_revisions;

    EXECUTE 'CREATE POLICY "kit_template_revisions_select" ON kit_template_revisions FOR SELECT USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND (kt.user_id = (select auth.uid()) OR kt.is_public = true)))';
    EXECUTE 'CREATE POLICY "kit_template_revisions_insert" ON kit_template_revisions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND kt.user_id = (select auth.uid())))';
    EXECUTE 'CREATE POLICY "kit_template_revisions_update" ON kit_template_revisions FOR UPDATE USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND kt.user_id = (select auth.uid())))';
    EXECUTE 'CREATE POLICY "kit_template_revisions_delete" ON kit_template_revisions FOR DELETE USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND kt.user_id = (select auth.uid())))';
  END IF;
END $$;
