-- =========================
-- Utility Functions
-- =========================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- Enums
-- =========================

DO $$ BEGIN
  CREATE TYPE tenant_type AS ENUM ('personal', 'team');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kit_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE permission_level AS ENUM ('view', 'edit', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_lot_status AS ENUM ('active', 'expired', 'used', 'disposed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- Core Tables
-- =========================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  stripe_customer_id VARCHAR(255),
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired')),
  subscription_expires_at TIMESTAMP,
  referral_code VARCHAR(50) UNIQUE,
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_rewards JSONB, -- { freeMonthsEarned: number, lastRewardDate: timestamp }
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('home', 'office', 'vehicle', 'backpack', 'general')),
  address TEXT,
  coordinates JSONB, -- { latitude: number, longitude: number }
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_primary ON locations(user_id, is_primary);

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tenants table (multi-tenancy)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type tenant_type NOT NULL,
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tenant members table
CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);

-- User defaults table
CREATE TABLE IF NOT EXISTS user_defaults (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_defaults_updated_at
  BEFORE UPDATE ON user_defaults
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- Supply Catalog
-- =========================

-- Supply categories table
CREATE TABLE IF NOT EXISTS supply_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_name VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'tenant')) DEFAULT 'global',
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_supply_categories_scope CHECK (
    (scope = 'global' AND tenant_id IS NULL) OR
    (scope = 'tenant' AND tenant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_supply_categories
  ON supply_categories(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name));

CREATE INDEX IF NOT EXISTS idx_supply_categories_tenant ON supply_categories(tenant_id);

CREATE TRIGGER update_supply_categories_updated_at
  BEFORE UPDATE ON supply_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Supplies table
CREATE TABLE IF NOT EXISTS supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES supply_categories(id) ON DELETE RESTRICT,
  category_name VARCHAR(255), -- Denormalized for performance
  brand VARCHAR(255),
  model VARCHAR(255),
  barcode VARCHAR(255),
  sku VARCHAR(255),
  unit_type VARCHAR(20) NOT NULL DEFAULT 'piece' CHECK (unit_type IN ('piece', 'box', 'pack', 'roll', 'bottle', 'tube')),
  base_unit TEXT NOT NULL DEFAULT 'each',
  expires BOOLEAN NOT NULL DEFAULT true,
  default_expiration_days INTEGER,
  osha_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  affiliate_link TEXT,
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  sponsored_by VARCHAR(255),
  sponsored_until TIMESTAMP,
  sponsored_priority INTEGER DEFAULT 0,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'tenant')) DEFAULT 'global',
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_supplies_scope CHECK (
    (scope = 'global' AND tenant_id IS NULL) OR
    (scope = 'tenant' AND tenant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_supplies_scope_name
  ON supplies(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name));

CREATE INDEX IF NOT EXISTS idx_supplies_category_id ON supplies(category_id);
CREATE INDEX IF NOT EXISTS idx_supplies_is_active ON supplies(is_active);
CREATE INDEX IF NOT EXISTS idx_supplies_sponsored ON supplies(is_sponsored, sponsored_priority DESC);
CREATE INDEX IF NOT EXISTS idx_supplies_name ON supplies(name);
CREATE INDEX IF NOT EXISTS idx_supplies_tenant ON supplies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplies_category_active ON supplies(category_id, is_active) WHERE is_active = true;

CREATE TRIGGER update_supplies_updated_at
  BEFORE UPDATE ON supplies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Supply variants table
CREATE TABLE IF NOT EXISTS supply_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  units_per_variant INTEGER NOT NULL CHECK (units_per_variant > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_variants_supply ON supply_variants(supply_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_supply_variants_supply_label
  ON supply_variants(supply_id, LOWER(label));

CREATE TRIGGER trg_supply_variants_updated_at
  BEFORE UPDATE ON supply_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- Kit Templates
-- =========================

-- Kit templates table
CREATE TABLE IF NOT EXISTS kit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for system/public templates
  name VARCHAR(255) NOT NULL,
  description TEXT,
  purpose VARCHAR(255) NOT NULL,
  group_size INTEGER NOT NULL DEFAULT 1,
  environment VARCHAR(255),
  skill_level VARCHAR(20) NOT NULL DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_prompt TEXT,
  default_people_count INTEGER NOT NULL DEFAULT 1,
  people_count_options INTEGER[], -- e.g., [2, 4, 8]
  public_template_id VARCHAR(255),
  created_by VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kit_templates_user_id ON kit_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_kit_templates_public ON kit_templates(is_public, is_active) WHERE is_public = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_kit_templates_created_by ON kit_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_kit_templates_public_template_id ON kit_templates(public_template_id);
CREATE INDEX IF NOT EXISTS idx_kit_templates_user_public ON kit_templates(user_id, is_public);

CREATE TRIGGER update_kit_templates_updated_at
  BEFORE UPDATE ON kit_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Kit template revisions table
CREATE TABLE IF NOT EXISTS kit_template_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_template_id UUID NOT NULL REFERENCES kit_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kit_template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_revisions_template ON kit_template_revisions(kit_template_id);
CREATE INDEX IF NOT EXISTS idx_template_revisions_version ON kit_template_revisions(kit_template_id, version DESC);

-- Kit template revision items table
CREATE TABLE IF NOT EXISTS kit_template_revision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_revision_id UUID NOT NULL REFERENCES kit_template_revisions(id) ON DELETE CASCADE,
  supply_id UUID NOT NULL REFERENCES supplies(id),
  variant_id UUID REFERENCES supply_variants(id) ON DELETE SET NULL,
  required_units INTEGER NOT NULL CHECK (required_units >= 0),
  notes TEXT,
  sort_order INTEGER,
  scales_with_people BOOLEAN NOT NULL DEFAULT false,
  people_count_units JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_revision_id, supply_id)
);

CREATE INDEX IF NOT EXISTS idx_template_items_revision ON kit_template_revision_items(template_revision_id);
CREATE INDEX IF NOT EXISTS idx_template_items_supply ON kit_template_revision_items(supply_id);

CREATE TRIGGER trg_template_revision_items_updated_at
  BEFORE UPDATE ON kit_template_revision_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- Kits
-- =========================

-- Kits table (direct, no containers abstraction)
CREATE TABLE IF NOT EXISTS kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_id UUID REFERENCES locations(id),
  status kit_status NOT NULL DEFAULT 'active',
  template_revision_id UUID REFERENCES kit_template_revisions(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB, -- Stores template information: {kit_template_id, kit_template_name}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kits_tenant_id ON kits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kits_location_id ON kits(location_id);
CREATE INDEX IF NOT EXISTS idx_kits_status ON kits(status);
CREATE INDEX IF NOT EXISTS idx_kits_name ON kits(name);
CREATE INDEX IF NOT EXISTS idx_kits_tenant_status ON kits(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kits_location_status ON kits(location_id, status);

CREATE TRIGGER trg_kits_updated_at
  BEFORE UPDATE ON kits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- Consolidated Inventory Items
-- =========================
-- This table consolidates both kit_items and inventory_items
-- - Items in kits: kit_id is set
-- - Items not in kits: kit_id is NULL
-- - Requirements/placeholders: is_requirement = true and/or quantity = 0

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES kits(id) ON DELETE SET NULL, -- NULL = not in a kit
  supply_id UUID REFERENCES supplies(id) ON DELETE SET NULL,
  freeform_name TEXT, -- Required if supply_id is NULL
  supply_name VARCHAR(255) NOT NULL, -- Denormalized for performance
  supply_category_id UUID REFERENCES supply_categories(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  location_name VARCHAR(255), -- Denormalized
  
  -- Quantity and status
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  is_requirement BOOLEAN NOT NULL DEFAULT false, -- true = placeholder/requirement, false = actual item
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used', 'disposed', 'missing')),
  
  -- Expiration tracking (simple case, complex cases use inventory_lots)
  expiration_date TIMESTAMP,
  
  -- Purchase info
  purchase_date TIMESTAMP,
  purchase_price DECIMAL(10, 2),
  supplier VARCHAR(255),
  
  -- Metadata
  notes TEXT,
  custom_fields JSONB,
  sent_notifications TEXT[], -- DEPRECATED: Use notification_events instead
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_inventory_supply_ref CHECK (
    (supply_id IS NOT NULL AND freeform_name IS NULL) OR
    (supply_id IS NULL AND freeform_name IS NOT NULL)
  )
);

-- Indexes for inventory_items
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_id ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_kit_id ON inventory_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_supply_id ON inventory_items(supply_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location_id ON inventory_items(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_requirement ON inventory_items(is_requirement);
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiration_date ON inventory_items(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiring ON inventory_items(status, expiration_date) WHERE status = 'active' AND expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_status ON inventory_items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_kit_status ON inventory_items(kit_id, status) WHERE kit_id IS NOT NULL;

-- Unique constraints for inventory_items
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_items_kit_supply
  ON inventory_items(kit_id, supply_id)
  WHERE supply_id IS NOT NULL AND kit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_items_kit_freeform
  ON inventory_items(kit_id, LOWER(freeform_name))
  WHERE supply_id IS NULL AND kit_id IS NOT NULL;

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inventory lots table (for multiple expirations per item)
CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_units INTEGER NOT NULL CHECK (quantity_units >= 0),
  expiration_date DATE,
  lot_code TEXT,
  purchase_date DATE,
  purchase_price NUMERIC(10, 2),
  supplier TEXT,
  status inventory_lot_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_item_exp ON inventory_lots(inventory_item_id, expiration_date);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_status_exp ON inventory_lots(status, expiration_date);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_item ON inventory_lots(inventory_item_id);

CREATE TRIGGER trg_inventory_lots_updated_at
  BEFORE UPDATE ON inventory_lots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- Sharing & Access Control
-- =========================

-- Kit ACL table (replaces shared_kits)
CREATE TABLE IF NOT EXISTS kit_acl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'tenant_role')),
  subject_id TEXT NOT NULL, -- user uuid string OR role string (owner/admin/member)
  permission permission_level NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kit_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_acl_kit ON kit_acl(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_acl_subject ON kit_acl(subject_type, subject_id);

-- Share links table
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(255) NOT NULL UNIQUE,
  permission VARCHAR(10) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(link_token);
CREATE INDEX IF NOT EXISTS idx_share_links_kit_id ON share_links(kit_id);
-- Note: Cannot use NOW() in index predicate (not immutable)
-- Filter for non-expired links in queries: WHERE expires_at IS NULL OR expires_at > NOW()
CREATE INDEX IF NOT EXISTS idx_share_links_kit_active ON share_links(kit_id, expires_at) WHERE expires_at IS NULL;

-- =========================
-- Notifications
-- =========================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- Device tokens table
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active ON device_tokens(user_id, is_active) WHERE is_active = true;

CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expiry_warning_days INTEGER[] NOT NULL DEFAULT '{30,15,7}',
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_tenant ON notification_preferences(tenant_id);

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notification events table
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL, -- e.g., "lot_expiry:<lot_id>:<days>"
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'inapp')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB,
  UNIQUE(user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_user ON notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_key ON notification_events(event_key);
CREATE INDEX IF NOT EXISTS idx_notification_events_sent_at ON notification_events(sent_at);

-- =========================
-- Customization
-- =========================

-- Custom fields table
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_user_id ON custom_fields(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_user_type ON custom_fields(user_id, field_type);

CREATE TRIGGER update_custom_fields_updated_at
  BEFORE UPDATE ON custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- User categories table
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_name VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_sort ON user_categories(user_id, sort_order);

CREATE TRIGGER update_user_categories_updated_at
  BEFORE UPDATE ON user_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- Teams (Legacy - may overlap with tenants)
-- =========================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_role ON team_members(user_id, role);

-- =========================
-- Business Features
-- =========================

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON api_keys(user_id, is_active) WHERE is_active = true;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON support_tickets(user_id, status);

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Affiliate tracking table
CREATE TABLE IF NOT EXISTS affiliate_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  affiliate_code VARCHAR(100),
  supply_id UUID REFERENCES supplies(id) ON DELETE SET NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_user_id ON affiliate_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_code ON affiliate_tracking(affiliate_code);

CREATE TRIGGER update_affiliate_tracking_updated_at
  BEFORE UPDATE ON affiliate_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Brand partnerships table
CREATE TABLE IF NOT EXISTS brand_partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_name VARCHAR(255),
  partnership_type VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_partnerships_status ON brand_partnerships(status);

CREATE TRIGGER update_brand_partnerships_updated_at
  BEFORE UPDATE ON brand_partnerships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RevenueCat customers table
CREATE TABLE IF NOT EXISTS revenuecat_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  entitlements JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenuecat_customers_user_id ON revenuecat_customers(user_id);

CREATE TRIGGER update_revenuecat_customers_updated_at
  BEFORE UPDATE ON revenuecat_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- AI Features
-- =========================

-- AI recommendations table
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  purpose TEXT NOT NULL,
  group_size INTEGER NOT NULL DEFAULT 1,
  environment TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  recommended_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 0.8 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  was_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created_at ON ai_recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_was_used ON ai_recommendations(was_used);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_created ON ai_recommendations(user_id, created_at DESC);

-- =========================
-- Views
-- =========================

-- View for kit actual units (from inventory_lots)
CREATE OR REPLACE VIEW v_kit_actual_units AS
SELECT
  k.id AS kit_id,
  COALESCE(ii.supply_id::text, ii.freeform_name) AS supply_key,
  SUM(il.quantity_units) AS actual_units
FROM kits k
JOIN inventory_items ii ON ii.kit_id = k.id
JOIN inventory_lots il ON il.inventory_item_id = ii.id
WHERE
  k.deleted_at IS NULL
  AND il.status = 'active'
  AND (il.expiration_date IS NULL OR il.expiration_date >= CURRENT_DATE)
GROUP BY k.id, COALESCE(ii.supply_id::text, ii.freeform_name);

-- View for kit item status (for requirements)
CREATE OR REPLACE VIEW v_kit_item_status AS
SELECT
  ii.id AS inventory_item_id,
  ii.kit_id,
  ii.supply_id,
  COALESCE(ii.supply_name, ii.freeform_name) AS supply_name,
  ii.quantity AS required_quantity,
  COALESCE(va.actual_units, 0) AS actual_quantity,
  CASE
    WHEN COALESCE(va.actual_units, 0) >= ii.quantity THEN 'complete'
    WHEN COALESCE(va.actual_units, 0) > 0 THEN 'partial'
    ELSE 'missing'
  END AS status
FROM inventory_items ii
LEFT JOIN v_kit_actual_units va
  ON va.kit_id = ii.kit_id
  AND (
    (ii.supply_id IS NOT NULL AND va.supply_key = ii.supply_id::text) OR
    (ii.supply_id IS NULL AND va.supply_key = ii.freeform_name)
  )
WHERE ii.kit_id IS NOT NULL;
