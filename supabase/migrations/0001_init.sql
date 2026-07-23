-- EverRedi v1 slim schema (workspaces, not tenants/teams dual model)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

DO $$ BEGIN CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE kit_status AS ENUM ('active', 'archived', 'incomplete', 'complete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE permission_level AS ENUM ('view', 'edit', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE inventory_item_status AS ENUM (
  'complete', 'partial', 'missing', 'used', 'disposed', 'expired'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE workspace_type AS ENUM ('personal', 'shared');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium')),
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'cancelled', 'expired')),
  subscription_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type workspace_type NOT NULL,
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role member_role NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status invite_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);

CREATE TABLE IF NOT EXISTS user_defaults (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_workspace_id UUID NOT NULL REFERENCES workspaces(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location_type VARCHAR(20) NOT NULL DEFAULT 'general'
    CHECK (location_type IN ('home', 'office', 'vehicle', 'backpack', 'general')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_workspace ON locations(workspace_id);

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS supply_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_name VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES supply_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_unit VARCHAR(50),
  typical_shelf_life_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplies_name ON supplies(name);

CREATE TABLE IF NOT EXISTS kit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kit_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES kit_templates(id) ON DELETE CASCADE,
  supply_id UUID REFERENCES supplies(id) ON DELETE SET NULL,
  freeform_name TEXT,
  supply_name VARCHAR(255) NOT NULL,
  required_quantity INTEGER NOT NULL DEFAULT 1 CHECK (required_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  status kit_status NOT NULL DEFAULT 'active',
  template_id UUID REFERENCES kit_templates(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kits_workspace ON kits(workspace_id);

CREATE TRIGGER update_kits_updated_at
  BEFORE UPDATE ON kits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
  supply_id UUID REFERENCES supplies(id) ON DELETE SET NULL,
  freeform_name TEXT,
  supply_name VARCHAR(255) NOT NULL,
  supply_category_id UUID REFERENCES supply_categories(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  required_quantity INTEGER CHECK (required_quantity >= 0),
  actual_quantity INTEGER CHECK (actual_quantity >= 0),
  status inventory_item_status NOT NULL DEFAULT 'missing',
  expiration_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_inventory_supply_ref CHECK (
    (supply_id IS NOT NULL AND freeform_name IS NULL) OR
    (supply_id IS NULL AND freeform_name IS NOT NULL) OR
    (supply_id IS NULL AND freeform_name IS NULL AND supply_name IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_workspace ON inventory_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inventory_kit ON inventory_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiration ON inventory_items(expiration_date)
  WHERE expiration_date IS NOT NULL;

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS kit_acl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission permission_level NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kit_id, user_id)
);

CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(255) NOT NULL UNIQUE,
  permission VARCHAR(10) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS revenuecat_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  app_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed catalog
INSERT INTO supply_categories (id, name, description, icon_name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Bandages', 'Wound care and dressings', 'bandage', 1),
  ('11111111-1111-1111-1111-111111111102', 'Medications', 'OTC medicines', 'pill', 2),
  ('11111111-1111-1111-1111-111111111103', 'Tools', 'Scissors, tweezers, and tools', 'tools', 3),
  ('11111111-1111-1111-1111-111111111104', 'PPE', 'Gloves, masks, and protection', 'shield', 4)
ON CONFLICT DO NOTHING;

INSERT INTO supplies (id, category_id, name, description, default_unit, typical_shelf_life_days) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Adhesive bandages', 'Assorted sizes', 'box', 1825),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Gauze pads', 'Sterile 4x4', 'pack', 1825),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'Antihistamine', 'Allergy relief', 'box', 730),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', 'Pain reliever', 'Ibuprofen or acetaminophen', 'bottle', 730),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', 'Trauma shears', 'Blunt tip shears', 'each', NULL),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111104', 'Nitrile gloves', 'Pair', 'pair', 1825)
ON CONFLICT DO NOTHING;

INSERT INTO kit_templates (id, name, description, category, is_public) VALUES
  ('33333333-3333-3333-3333-333333333301', 'Home first aid', 'Starter kit for home', 'home', true),
  ('33333333-3333-3333-3333-333333333302', 'Vehicle kit', 'Compact kit for the car', 'vehicle', true)
ON CONFLICT DO NOTHING;

INSERT INTO kit_template_items (template_id, supply_id, freeform_name, supply_name, required_quantity) VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', NULL, 'Adhesive bandages', 1),
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222202', NULL, 'Gauze pads', 2),
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222204', NULL, 'Pain reliever', 1),
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222206', NULL, 'Nitrile gloves', 4),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', NULL, 'Adhesive bandages', 1),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222205', NULL, 'Trauma shears', 1),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222206', NULL, 'Nitrile gloves', 2)
ON CONFLICT DO NOTHING;
