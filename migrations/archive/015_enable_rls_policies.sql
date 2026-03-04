-- =============================================================================
-- Migration: Enable RLS and add policies on public tables
-- Works with both legacy schema (user_kits, kit_items, inventory_items.user_id)
-- and consolidated schema (tenants, kits, inventory_items.tenant_id).
-- Policies are only created when the table exists. The API uses the service
-- role and bypasses RLS; these policies protect direct access via anon/authenticated keys.
-- =============================================================================

-- 1. Fix function search_path (resolves "function search path mutable" advisory)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Enable RLS on all public tables (IF EXISTS skips missing tables)
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supply_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kit_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kit_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kit_template_revision_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shared_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kit_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS affiliate_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS brand_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS revenuecat_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS osha_compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alert_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS low_stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supply_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scheduled_broadcasts ENABLE ROW LEVEL SECURITY;

-- 3. Policies: user-owned (always run; core tables assumed present)
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "locations_own" ON locations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "device_tokens_own" ON device_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "custom_fields_own" ON custom_fields FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_categories_own" ON user_categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "api_keys_own" ON api_keys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "support_tickets_own" ON support_tickets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "affiliate_tracking_own" ON affiliate_tracking FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "revenuecat_customers_own" ON revenuecat_customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ai_recommendations_own" ON ai_recommendations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "compliance_checks_own" ON compliance_checks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "alert_thresholds_own" ON alert_thresholds FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "low_stock_alerts_own" ON low_stock_alerts FOR ALL USING (auth.uid() = user_id);

-- 4. Tenant-scoped (consolidated schema): only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
    EXECUTE 'CREATE POLICY "tenants_owner" ON tenants FOR ALL USING (auth.uid() = owner_user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_members') THEN
    EXECUTE 'CREATE POLICY "tenant_members_select" ON tenant_members FOR SELECT USING (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "tenant_members_insert" ON tenant_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "tenant_members_update" ON tenant_members FOR UPDATE USING (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "tenant_members_delete" ON tenant_members FOR DELETE USING (EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_id AND t.owner_user_id = auth.uid()))';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kits') THEN
    EXECUTE 'CREATE POLICY "kits_tenant" ON kits FOR ALL USING (EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = kits.tenant_id AND tm.user_id = auth.uid()))';
  END IF;
END $$;

-- inventory_items: tenant-scoped if tenant_id exists, else user-scoped (legacy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'tenant_id') THEN
    EXECUTE 'CREATE POLICY "inventory_items_tenant" ON inventory_items FOR ALL USING (EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = inventory_items.tenant_id AND tm.user_id = auth.uid()))';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE POLICY "inventory_items_own" ON inventory_items FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_acl') THEN
    EXECUTE 'CREATE POLICY "kit_acl_tenant" ON kit_acl FOR ALL USING (EXISTS (SELECT 1 FROM kits k INNER JOIN tenant_members tm ON tm.tenant_id = k.tenant_id AND tm.user_id = auth.uid() WHERE k.id = kit_acl.kit_id))';
  END IF;
END $$;

-- notification_preferences: tenant-scoped if tenant_id exists, else user-scoped (legacy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'tenant_id') THEN
    EXECUTE 'CREATE POLICY "notification_preferences_tenant" ON notification_preferences FOR ALL USING (EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = notification_preferences.tenant_id AND tm.user_id = auth.uid()))';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_preferences') THEN
    EXECUTE 'CREATE POLICY "notification_preferences_own" ON notification_preferences FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_events') THEN
    EXECUTE 'CREATE POLICY "notification_events_own" ON notification_events FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;

-- 5. user_defaults (consolidated only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_defaults') THEN
    EXECUTE 'CREATE POLICY "user_defaults_own" ON user_defaults FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;

-- 6. kit_templates: own or public
CREATE POLICY "kit_templates_select" ON kit_templates FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);
CREATE POLICY "kit_templates_insert" ON kit_templates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "kit_templates_update" ON kit_templates FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "kit_templates_delete" ON kit_templates FOR DELETE USING (user_id = auth.uid());

-- 7. kit_template_items: only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_items') THEN
    EXECUTE 'CREATE POLICY "kit_template_items_select" ON kit_template_items FOR SELECT USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_items.kit_template_id AND (kt.user_id = auth.uid() OR kt.is_public = true)))';
    EXECUTE 'CREATE POLICY "kit_template_items_modify" ON kit_template_items FOR ALL USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_items.kit_template_id AND kt.user_id = auth.uid()))';
  END IF;
END $$;

-- 8. kit_template_revisions / kit_template_revision_items (consolidated only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revisions') THEN
    EXECUTE 'CREATE POLICY "kit_template_revisions_select" ON kit_template_revisions FOR SELECT USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND (kt.user_id = auth.uid() OR kt.is_public = true)))';
    EXECUTE 'CREATE POLICY "kit_template_revisions_all" ON kit_template_revisions FOR ALL USING (EXISTS (SELECT 1 FROM kit_templates kt WHERE kt.id = kit_template_revisions.kit_template_id AND kt.user_id = auth.uid()))';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_revision_items') THEN
    EXECUTE 'CREATE POLICY "kit_template_revision_items_select" ON kit_template_revision_items FOR SELECT USING (EXISTS (SELECT 1 FROM kit_template_revisions r INNER JOIN kit_templates kt ON kt.id = r.kit_template_id WHERE r.id = kit_template_revision_items.template_revision_id AND (kt.user_id = auth.uid() OR kt.is_public = true)))';
    EXECUTE 'CREATE POLICY "kit_template_revision_items_all" ON kit_template_revision_items FOR ALL USING (EXISTS (SELECT 1 FROM kit_template_revisions r INNER JOIN kit_templates kt ON kt.id = r.kit_template_id WHERE r.id = kit_template_revision_items.template_revision_id AND kt.user_id = auth.uid()))';
  END IF;
END $$;

-- 9. inventory_lots (consolidated; requires inventory_items.tenant_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_lots') THEN
    EXECUTE 'CREATE POLICY "inventory_lots_tenant" ON inventory_lots FOR ALL USING (EXISTS (SELECT 1 FROM inventory_items ii INNER JOIN tenant_members tm ON tm.tenant_id = ii.tenant_id AND tm.user_id = auth.uid() WHERE ii.id = inventory_lots.inventory_item_id))';
  END IF;
END $$;

-- 10. Legacy: user_kits, kit_items, shared_kits (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_kits') THEN
    EXECUTE 'CREATE POLICY "user_kits_own" ON user_kits FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_items') THEN
    EXECUTE 'CREATE POLICY "kit_items_via_kit" ON kit_items FOR ALL USING (EXISTS (SELECT 1 FROM user_kits uk WHERE uk.id = kit_items.user_kit_id AND uk.user_id = auth.uid()))';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_kits') THEN
    EXECUTE 'CREATE POLICY "shared_kits_owner_or_shared" ON shared_kits FOR ALL USING (owner_id = auth.uid() OR shared_with_user_id = auth.uid())';
  END IF;
END $$;

-- 11. share_links: owner
CREATE POLICY "share_links_own" ON share_links FOR ALL USING (auth.uid() = owner_id);

-- 12. teams: owner or member
CREATE POLICY "teams_owner" ON teams FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "team_members_visible" ON team_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = auth.uid()));
CREATE POLICY "team_members_modify" ON team_members FOR ALL
  USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = auth.uid()));

-- 13. Reference / catalog: read-only for authenticated
CREATE POLICY "supply_categories_select" ON supply_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplies_select" ON supplies FOR SELECT TO authenticated USING (true);
CREATE POLICY "osha_compliance_rules_select" ON osha_compliance_rules FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supply_variants') THEN
    EXECUTE 'CREATE POLICY "supply_variants_select" ON supply_variants FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- 14. brand_partnerships
CREATE POLICY "brand_partnerships_select" ON brand_partnerships FOR SELECT TO authenticated USING (true);

-- 15. scheduled_broadcasts: admin-only (no user_id on table; allow only users with is_admin = true)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_broadcasts') THEN
    EXECUTE 'CREATE POLICY "scheduled_broadcasts_admin" ON scheduled_broadcasts FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true))';
  END IF;
END $$;
