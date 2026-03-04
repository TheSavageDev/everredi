-- =============================================================================
-- Migration: RLS performance (auth.uid() -> (select auth.uid())), drop redundant
-- SELECT policies, and drop duplicate indexes. Addresses Supabase performance advisor.
-- =============================================================================

-- 1. Drop duplicate indexes (keep one of each pair)
DROP INDEX IF EXISTS idx_device_tokens_user_active;
DROP INDEX IF EXISTS idx_inventory_items_expiring;

-- 2. Drop redundant SELECT policies (multiple permissive for same role+action)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revision_items') THEN
  DROP POLICY IF EXISTS "kit_template_revision_items_select" ON kit_template_revision_items;
END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revisions') THEN
  DROP POLICY IF EXISTS "kit_template_revisions_select" ON kit_template_revisions;
END IF; END $$;
DROP POLICY IF EXISTS "team_members_visible" ON team_members;

-- 3. Recreate policies with (select auth.uid()) for init plan performance
--    Drop then create each policy that uses auth.uid().

-- users
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT USING ((select auth.uid()) = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING ((select auth.uid()) = id);

-- locations
DROP POLICY IF EXISTS "locations_own" ON locations;
CREATE POLICY "locations_own" ON locations FOR ALL USING ((select auth.uid()) = user_id);

-- notifications, device_tokens, custom_fields, user_categories, api_keys, support_tickets, affiliate_tracking, revenuecat_customers, ai_recommendations, compliance_checks, alert_thresholds, low_stock_alerts
DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "device_tokens_own" ON device_tokens;
CREATE POLICY "device_tokens_own" ON device_tokens FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "custom_fields_own" ON custom_fields;
CREATE POLICY "custom_fields_own" ON custom_fields FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_categories_own" ON user_categories;
CREATE POLICY "user_categories_own" ON user_categories FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "api_keys_own" ON api_keys;
CREATE POLICY "api_keys_own" ON api_keys FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "support_tickets_own" ON support_tickets;
CREATE POLICY "support_tickets_own" ON support_tickets FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "affiliate_tracking_own" ON affiliate_tracking;
CREATE POLICY "affiliate_tracking_own" ON affiliate_tracking FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "revenuecat_customers_own" ON revenuecat_customers;
CREATE POLICY "revenuecat_customers_own" ON revenuecat_customers FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ai_recommendations_own" ON ai_recommendations;
CREATE POLICY "ai_recommendations_own" ON ai_recommendations FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "compliance_checks_own" ON compliance_checks;
CREATE POLICY "compliance_checks_own" ON compliance_checks FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "alert_thresholds_own" ON alert_thresholds;
CREATE POLICY "alert_thresholds_own" ON alert_thresholds FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "low_stock_alerts_own" ON low_stock_alerts;
CREATE POLICY "low_stock_alerts_own" ON low_stock_alerts FOR ALL USING ((select auth.uid()) = user_id);

-- tenants (consolidated)
DROP POLICY IF EXISTS "tenants_owner" ON tenants;
CREATE POLICY "tenants_owner" ON tenants FOR ALL USING ((select auth.uid()) = owner_user_id);

-- tenant_members (consolidated)
DROP POLICY IF EXISTS "tenant_members_select" ON tenant_members;
DROP POLICY IF EXISTS "tenant_members_insert" ON tenant_members;
DROP POLICY IF EXISTS "tenant_members_update" ON tenant_members;
DROP POLICY IF EXISTS "tenant_members_delete" ON tenant_members;
CREATE POLICY "tenant_members_select" ON tenant_members FOR SELECT USING (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = (select auth.uid())));
CREATE POLICY "tenant_members_insert" ON tenant_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = (select auth.uid())));
CREATE POLICY "tenant_members_update" ON tenant_members FOR UPDATE USING (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = (select auth.uid())));
CREATE POLICY "tenant_members_delete" ON tenant_members FOR DELETE USING (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = (select auth.uid())));

-- kits (consolidated)
DROP POLICY IF EXISTS "kits_tenant" ON kits;
CREATE POLICY "kits_tenant" ON kits FOR ALL USING (EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = kits.tenant_id AND tm.user_id = (select auth.uid())));

-- inventory_items: tenant or own (policy name depends on schema; drop both possible names)
DROP POLICY IF EXISTS "inventory_items_tenant" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_own" ON inventory_items;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'tenant_id') THEN
    EXECUTE 'CREATE POLICY "inventory_items_tenant" ON inventory_items FOR ALL USING (EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = inventory_items.tenant_id AND tm.user_id = (select auth.uid())))';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE POLICY "inventory_items_own" ON inventory_items FOR ALL USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

-- kit_acl (consolidated)
DROP POLICY IF EXISTS "kit_acl_tenant" ON kit_acl;
CREATE POLICY "kit_acl_tenant" ON kit_acl FOR ALL USING (EXISTS (SELECT 1 FROM kits k INNER JOIN tenant_members tm ON tm.tenant_id = k.tenant_id AND tm.user_id = (select auth.uid()) WHERE k.id = kit_acl.kit_id));

-- notification_preferences: tenant or own
DROP POLICY IF EXISTS "notification_preferences_tenant" ON notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_own" ON notification_preferences;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'tenant_id') THEN
    EXECUTE 'CREATE POLICY "notification_preferences_tenant" ON notification_preferences FOR ALL USING (EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = notification_preferences.tenant_id AND tm.user_id = (select auth.uid())))';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_preferences') THEN
    EXECUTE 'CREATE POLICY "notification_preferences_own" ON notification_preferences FOR ALL USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

-- notification_events (table may not exist)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_events') THEN
  DROP POLICY IF EXISTS "notification_events_own" ON notification_events;
  EXECUTE 'CREATE POLICY "notification_events_own" ON notification_events FOR ALL USING ((select auth.uid()) = user_id)';
END IF; END $$;

-- user_defaults (consolidated; table may not exist)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_defaults') THEN
  DROP POLICY IF EXISTS "user_defaults_own" ON user_defaults;
  EXECUTE 'CREATE POLICY "user_defaults_own" ON user_defaults FOR ALL USING ((select auth.uid()) = user_id)';
END IF; END $$;

-- kit_templates
DROP POLICY IF EXISTS "kit_templates_select" ON kit_templates;
DROP POLICY IF EXISTS "kit_templates_insert" ON kit_templates;
DROP POLICY IF EXISTS "kit_templates_update" ON kit_templates;
DROP POLICY IF EXISTS "kit_templates_delete" ON kit_templates;
CREATE POLICY "kit_templates_select" ON kit_templates FOR SELECT USING (user_id = (select auth.uid()) OR is_public = true);
CREATE POLICY "kit_templates_insert" ON kit_templates FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "kit_templates_update" ON kit_templates FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "kit_templates_delete" ON kit_templates FOR DELETE USING (user_id = (select auth.uid()));

-- kit_template_items (consolidated; table may not exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_items') THEN
    DROP POLICY IF EXISTS "kit_template_items_select" ON kit_template_items;
    DROP POLICY IF EXISTS "kit_template_items_modify" ON kit_template_items;
    EXECUTE 'CREATE POLICY "kit_template_items_select" ON kit_template_items FOR SELECT USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_items.kit_template_id AND (kt.user_id = (select auth.uid()) OR kt.is_public = true)))';
    EXECUTE 'CREATE POLICY "kit_template_items_modify" ON kit_template_items FOR ALL USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_items.kit_template_id AND kt.user_id = (select auth.uid())))';
  END IF;
END $$;

-- kit_template_revisions (only _all remains; recreate with (select auth.uid()); table may not exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revisions') THEN
    DROP POLICY IF EXISTS "kit_template_revisions_all" ON kit_template_revisions;
    EXECUTE 'CREATE POLICY "kit_template_revisions_all" ON kit_template_revisions FOR ALL USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND kt.user_id = (select auth.uid())))';
  END IF;
END $$;

-- kit_template_revisions: add SELECT-only policy for public/owner read (so anon can read public templates)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revisions') THEN
    EXECUTE 'CREATE POLICY "kit_template_revisions_select" ON kit_template_revisions FOR SELECT USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND (kt.user_id = (select auth.uid()) OR kt.is_public = true)))';
  END IF;
END $$;

-- kit_template_revision_items (only _all remains; table may not exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revision_items') THEN
    DROP POLICY IF EXISTS "kit_template_revision_items_all" ON kit_template_revision_items;
    EXECUTE 'CREATE POLICY "kit_template_revision_items_all" ON kit_template_revision_items FOR ALL USING (EXISTS (SELECT 1 FROM kit_template_revisions r INNER JOIN kit_templates kt ON kt.id = r.kit_template_id WHERE r.id = kit_template_revision_items.template_revision_id AND kt.user_id = (select auth.uid())))';
  END IF;
END $$;

-- inventory_lots (consolidated; table may not exist)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_lots') THEN
  DROP POLICY IF EXISTS "inventory_lots_tenant" ON inventory_lots;
  EXECUTE 'CREATE POLICY "inventory_lots_tenant" ON inventory_lots FOR ALL USING (EXISTS (SELECT 1 FROM inventory_items ii INNER JOIN tenant_members tm ON tm.tenant_id = ii.tenant_id AND tm.user_id = (select auth.uid()) WHERE ii.id = inventory_lots.inventory_item_id))';
END IF; END $$;

-- Legacy: user_kits, kit_items, shared_kits (tables may not exist)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_kits') THEN
  DROP POLICY IF EXISTS "user_kits_own" ON user_kits;
  EXECUTE 'CREATE POLICY "user_kits_own" ON user_kits FOR ALL USING ((select auth.uid()) = user_id)';
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_items') THEN
  DROP POLICY IF EXISTS "kit_items_via_kit" ON kit_items;
  EXECUTE 'CREATE POLICY "kit_items_via_kit" ON kit_items FOR ALL USING (EXISTS (SELECT 1 FROM user_kits uk WHERE uk.id = kit_items.user_kit_id AND uk.user_id = (select auth.uid())))';
END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_kits') THEN
  DROP POLICY IF EXISTS "shared_kits_owner_or_shared" ON shared_kits;
  EXECUTE 'CREATE POLICY "shared_kits_owner_or_shared" ON shared_kits FOR ALL USING (owner_id = (select auth.uid()) OR shared_with_user_id = (select auth.uid()))';
END IF; END $$;

-- share_links, teams, team_members
DROP POLICY IF EXISTS "share_links_own" ON share_links;
CREATE POLICY "share_links_own" ON share_links FOR ALL USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "teams_owner" ON teams;
CREATE POLICY "teams_owner" ON teams FOR ALL USING ((select auth.uid()) = owner_id);

-- team_members: one SELECT policy (member or owner); insert/update/delete for owner only (avoids multiple permissive for SELECT)
DROP POLICY IF EXISTS "team_members_modify" ON team_members;
CREATE POLICY "team_members_visible" ON team_members FOR SELECT USING (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = (select auth.uid())));
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = (select auth.uid())));
CREATE POLICY "team_members_update" ON team_members FOR UPDATE USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = (select auth.uid())));
CREATE POLICY "team_members_delete" ON team_members FOR DELETE USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = (select auth.uid())));

-- scheduled_broadcasts: admin-only (table may not exist)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_broadcasts') THEN
  DROP POLICY IF EXISTS "scheduled_broadcasts_admin" ON scheduled_broadcasts;
  EXECUTE 'CREATE POLICY "scheduled_broadcasts_admin" ON scheduled_broadcasts FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = (select auth.uid()) AND u.is_admin = true))';
END IF; END $$;
</think>
Fixing the migration: we shouldn't re-add the dropped SELECT policies (that would recreate the "multiple permissive" warning). Checking the advisor again and simplifying.
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace