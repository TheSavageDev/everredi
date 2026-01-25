-- Combined migrations for DEV project
-- Generated: 2026-01-05T22:52:00.338Z
-- Project: https://lbzpxelosiandjlwsazk.supabase.co

-- ============================================
-- IMPORTANT: Review this SQL before executing
-- ============================================

-- ============================================
-- Migration: 001_create_users_table.sql
-- ============================================

-- Create users table
-- This table stores user account information

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
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

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on referral_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- Create index on referred_by for counting referrals
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- Create index on firebase_uid for auth lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 002_create_locations_table.sql
-- ============================================

-- Create locations table
-- This table stores user locations (home, office, vehicle, etc.)

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

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 003_create_supplies_tables.sql
-- ============================================

-- Create supply_categories table
-- This table stores supply categories

CREATE TABLE IF NOT EXISTS supply_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon_name VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create supplies table
-- This table stores the curated supply catalog

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
  default_expiration_days INTEGER,
  osha_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  affiliate_link TEXT,
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  sponsored_by VARCHAR(255),
  sponsored_until TIMESTAMP,
  sponsored_priority INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on category_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_supplies_category_id ON supplies(category_id);

-- Create index on is_active for filtering active supplies
CREATE INDEX IF NOT EXISTS idx_supplies_is_active ON supplies(is_active);

-- Create index on is_sponsored and sponsored_priority for sorting
CREATE INDEX IF NOT EXISTS idx_supplies_sponsored ON supplies(is_sponsored, sponsored_priority DESC);

-- Create index on name for search
CREATE INDEX IF NOT EXISTS idx_supplies_name ON supplies(name);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_supply_categories_updated_at
  BEFORE UPDATE ON supply_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplies_updated_at
  BEFORE UPDATE ON supplies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 004_create_user_kits_table.sql
-- ============================================

-- Create user_kits table
-- This table stores user's emergency kits

CREATE TABLE IF NOT EXISTS user_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  location_name VARCHAR(255), -- Denormalized for performance
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'incomplete', 'complete', 'archived')),
  notes TEXT,
  kit_template_id UUID, -- Optional reference to template used
  kit_template_name VARCHAR(255), -- Denormalized template name
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_kits_user_id ON user_kits(user_id);

-- Create index on location_id for filtering by location
CREATE INDEX IF NOT EXISTS idx_user_kits_location_id ON user_kits(location_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_user_kits_status ON user_kits(status);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_kits_updated_at
  BEFORE UPDATE ON user_kits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 005_create_kit_items_table.sql
-- ============================================

-- Create kit_items table
-- This table stores items within kits

CREATE TABLE IF NOT EXISTS kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_kit_id UUID NOT NULL REFERENCES user_kits(id) ON DELETE CASCADE,
  supply_id UUID REFERENCES supplies(id) ON DELETE SET NULL,
  supply_name VARCHAR(255) NOT NULL, -- Denormalized for performance
  inventory_item_id UUID, -- Optional reference to inventory item
  required_quantity INTEGER NOT NULL DEFAULT 1 CHECK (required_quantity >= 0),
  actual_quantity INTEGER NOT NULL DEFAULT 0 CHECK (actual_quantity >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'partial', 'complete')),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_kit_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_kit_items_user_kit_id ON kit_items(user_kit_id);

-- Create index on supply_id for filtering by supply
CREATE INDEX IF NOT EXISTS idx_kit_items_supply_id ON kit_items(supply_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_kit_items_updated_at
  BEFORE UPDATE ON kit_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 006_create_shared_kits_table.sql
-- ============================================

-- Create shared_kits table
-- CRITICAL: This table solves the O(n*m*k) query problem!
-- Instead of nested subcollections, we use a flat table with indexed lookups

CREATE TABLE IF NOT EXISTS shared_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES user_kits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(10) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  shared_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Prevent duplicate shares
  UNIQUE(kit_id, shared_with_user_id)
);

-- CRITICAL INDEX: This enables O(log n) lookups instead of O(n*m*k)
-- This is the key performance improvement for the shared kits query
CREATE INDEX IF NOT EXISTS idx_shared_kits_shared_with_user_id ON shared_kits(shared_with_user_id);

-- Create index on kit_id for owner lookups
CREATE INDEX IF NOT EXISTS idx_shared_kits_kit_id ON shared_kits(kit_id);

-- Create index on owner_id for owner queries
CREATE INDEX IF NOT EXISTS idx_shared_kits_owner_id ON shared_kits(owner_id);

-- Create index on (kit_id, shared_with_user_id) for permission checks (covered by unique constraint, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_shared_kits_kit_user ON shared_kits(kit_id, shared_with_user_id);




-- ============================================
-- Migration: 007_create_inventory_items_table.sql
-- ============================================

-- Create inventory_items table
-- This table stores user inventory items

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supply_id UUID REFERENCES supplies(id) ON DELETE SET NULL,
  supply_name VARCHAR(255) NOT NULL, -- Required: free-form name user enters
  supply_category_id UUID REFERENCES supply_categories(id) ON DELETE SET NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  location_name VARCHAR(255), -- Denormalized for performance
  kit_id UUID REFERENCES user_kits(id) ON DELETE SET NULL, -- Optional: if item belongs to a kit
  kit_name VARCHAR(255), -- Denormalized kit name
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  expiration_date TIMESTAMP,
  purchase_date TIMESTAMP,
  purchase_price DECIMAL(10, 2),
  supplier VARCHAR(255),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used', 'disposed')),
  sent_notifications TEXT[], -- Array of days for which notifications have been sent (e.g., ['60', '30', '10', '1'])
  custom_fields JSONB, -- Custom field values keyed by fieldId
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);

-- Create index on location_id for filtering by location
CREATE INDEX IF NOT EXISTS idx_inventory_items_location_id ON inventory_items(location_id);

-- Create index on kit_id for filtering by kit
CREATE INDEX IF NOT EXISTS idx_inventory_items_kit_id ON inventory_items(kit_id);

-- Create index on status for filtering active items
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);

-- Create index on expiration_date for expiration queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiration_date ON inventory_items(expiration_date) WHERE expiration_date IS NOT NULL;

-- Create composite index for expiring items queries (status = 'active' AND expiration_date BETWEEN now AND threshold)
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiring ON inventory_items(status, expiration_date) WHERE status = 'active' AND expiration_date IS NOT NULL;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 008_create_kit_templates_table.sql
-- ============================================

-- Create kit_templates table
-- This table stores kit templates (both user-created and public)

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
  people_count_options INTEGER[], -- e.g., [2, 4, 8] - additional options beyond default
  public_template_id VARCHAR(255), -- Reference to user template if synced from user (format: userId/templateId)
  created_by VARCHAR(255), -- userId who created it, or 'system' for default templates
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for user template lookups
CREATE INDEX IF NOT EXISTS idx_kit_templates_user_id ON kit_templates(user_id);

-- Create index on is_public and is_active for public template queries
CREATE INDEX IF NOT EXISTS idx_kit_templates_public ON kit_templates(is_public, is_active) WHERE is_public = true AND is_active = true;

-- Create index on created_by for system templates
CREATE INDEX IF NOT EXISTS idx_kit_templates_created_by ON kit_templates(created_by);

-- Create index on public_template_id for syncing
CREATE INDEX IF NOT EXISTS idx_kit_templates_public_template_id ON kit_templates(public_template_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_kit_templates_updated_at
  BEFORE UPDATE ON kit_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create kit_template_items table
-- This table stores items within kit templates

CREATE TABLE IF NOT EXISTS kit_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_template_id UUID NOT NULL REFERENCES kit_templates(id) ON DELETE CASCADE,
  supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE RESTRICT,
  supply_name VARCHAR(255), -- Denormalized for performance
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  scales_with_people BOOLEAN NOT NULL DEFAULT false,
  people_count_quantities JSONB, -- { 2: 4, 4: 8, 8: 16 } - explicit quantities for different people counts
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on kit_template_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_kit_template_items_template_id ON kit_template_items(kit_template_id);

-- Create index on sort_order for ordering
CREATE INDEX IF NOT EXISTS idx_kit_template_items_sort_order ON kit_template_items(kit_template_id, sort_order);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_kit_template_items_updated_at
  BEFORE UPDATE ON kit_template_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 009_create_additional_tables.sql
-- ============================================

-- Create share_links table
-- This table stores shareable links for kits

CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES user_kits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(255) NOT NULL UNIQUE,
  permission VARCHAR(10) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on link_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(link_token);

-- Create index on kit_id for owner queries
CREATE INDEX IF NOT EXISTS idx_share_links_kit_id ON share_links(kit_id);

-- Create notifications table
-- This table stores user notifications

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional notification data
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Create index on is_read and created_at for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;

-- Create device_tokens table
-- This table stores push notification device tokens

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

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

-- Create index on is_active for active token queries
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(user_id, is_active) WHERE is_active = true;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create teams table
-- This table stores teams/organizations

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on owner_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create team_members table
-- This table stores team membership

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Create index on team_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- Create index on user_id for user's teams
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Create custom_fields table
-- This table stores custom field definitions

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_custom_fields_user_id ON custom_fields(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_custom_fields_updated_at
  BEFORE UPDATE ON custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create user_categories table
-- This table stores user-created categories

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

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_categories_updated_at
  BEFORE UPDATE ON user_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create api_keys table
-- This table stores API keys for programmatic access

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE, -- Hashed API key
  name VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Create index on key_hash for key validation
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create support_tickets table
-- This table stores support tickets

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

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create affiliate_tracking table
-- This table stores affiliate tracking data

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

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_user_id ON affiliate_tracking(user_id);

-- Create index on affiliate_code for tracking
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_code ON affiliate_tracking(affiliate_code);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_affiliate_tracking_updated_at
  BEFORE UPDATE ON affiliate_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create brand_partnerships table
-- This table stores brand partnership information

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

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_brand_partnerships_status ON brand_partnerships(status);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_brand_partnerships_updated_at
  BEFORE UPDATE ON brand_partnerships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create revenuecat_customers table
-- This table stores RevenueCat customer data (synced from Firebase Extension)

CREATE TABLE IF NOT EXISTS revenuecat_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  entitlements JSONB, -- Full entitlements object from RevenueCat
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_revenuecat_customers_user_id ON revenuecat_customers(user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_revenuecat_customers_updated_at
  BEFORE UPDATE ON revenuecat_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




-- ============================================
-- Migration: 010_create_indexes.sql
-- ============================================

-- Additional performance indexes
-- This file contains indexes that are critical for query performance

-- CRITICAL: Index for shared_kits query (already created in 006, but documented here)
-- This index enables O(log n) lookups instead of O(n*m*k) nested loops
-- CREATE INDEX idx_shared_kits_shared_with_user_id ON shared_kits(shared_with_user_id);

-- Composite index for shared kits with kit name join
-- This can help with queries that join shared_kits and user_kits
CREATE INDEX IF NOT EXISTS idx_shared_kits_user_kit ON shared_kits(shared_with_user_id, kit_id);

-- Index for user kits by user and status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_user_kits_user_status ON user_kits(user_id, status);

-- Index for inventory items by user and status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_status ON inventory_items(user_id, status);

-- Index for kit items by kit and status
CREATE INDEX IF NOT EXISTS idx_kit_items_kit_status ON kit_items(user_kit_id, status);

-- Index for locations by user and is_primary
CREATE INDEX IF NOT EXISTS idx_locations_user_primary ON locations(user_id, is_primary);

-- Index for supplies by category and active status
CREATE INDEX IF NOT EXISTS idx_supplies_category_active ON supplies(category_id, is_active) WHERE is_active = true;

-- Index for notifications by user and read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- Index for device tokens by user and active status
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active ON device_tokens(user_id, is_active) WHERE is_active = true;

-- Index for team members by user (to find all teams a user belongs to)
CREATE INDEX IF NOT EXISTS idx_team_members_user_role ON team_members(user_id, role);

-- Index for custom fields by user
CREATE INDEX IF NOT EXISTS idx_custom_fields_user_type ON custom_fields(user_id, field_type);

-- Index for user categories by user and sort order
CREATE INDEX IF NOT EXISTS idx_user_categories_user_sort ON user_categories(user_id, sort_order);

-- Index for API keys by user and active status
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON api_keys(user_id, is_active) WHERE is_active = true;

-- Index for support tickets by user and status
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON support_tickets(user_id, status);

-- Index for kit templates by user and public status
CREATE INDEX IF NOT EXISTS idx_kit_templates_user_public ON kit_templates(user_id, is_public);

-- Index for share links by kit and active (non-expired)
-- Note: Cannot use NOW() in index predicate, so we index on expires_at and filter in queries
CREATE INDEX IF NOT EXISTS idx_share_links_kit_active ON share_links(kit_id, expires_at) WHERE expires_at IS NULL;



