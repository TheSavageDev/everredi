import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member']);
export const kitStatusEnum = pgEnum('kit_status', [
  'active',
  'archived',
  'incomplete',
  'complete',
]);
export const permissionLevelEnum = pgEnum('permission_level', [
  'view',
  'edit',
  'admin',
]);
export const inventoryItemStatusEnum = pgEnum('inventory_item_status', [
  'complete',
  'partial',
  'missing',
  'used',
  'disposed',
  'expired',
]);
export const workspaceTypeEnum = pgEnum('workspace_type', ['personal', 'shared']);
export const inviteStatusEnum = pgEnum('invite_status', [
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  subscriptionTier: varchar('subscription_tier', { length: 20 })
    .notNull()
    .default('free'),
  subscriptionStatus: varchar('subscription_status', { length: 20 })
    .notNull()
    .default('active'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', {
    withTimezone: true,
  }),
  isAdmin: boolean('is_admin').notNull().default(false),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: workspaceTypeEnum('type').notNull(),
  name: text('name').notNull(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('workspace_members_unique').on(t.workspaceId, t.userId)],
);

export const workspaceInvites = pgTable('workspace_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: memberRoleEnum('role').notNull().default('member'),
  status: inviteStatusEnum('status').notNull().default('pending'),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userDefaults = pgTable('user_defaults', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  defaultWorkspaceId: uuid('default_workspace_id')
    .notNull()
    .references(() => workspaces.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  locationType: varchar('location_type', { length: 20 }).notNull().default('general'),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supplyCategories = pgTable('supply_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  iconName: varchar('icon_name', { length: 100 }),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supplies = pgTable('supplies', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => supplyCategories.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  defaultUnit: varchar('default_unit', { length: 50 }),
  typicalShelfLifeDays: integer('typical_shelf_life_days'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kitTemplates = pgTable('kit_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  isPublic: boolean('is_public').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kitTemplateItems = pgTable('kit_template_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => kitTemplates.id, { onDelete: 'cascade' }),
  supplyId: uuid('supply_id').references(() => supplies.id, { onDelete: 'set null' }),
  freeformName: text('freeform_name'),
  supplyName: varchar('supply_name', { length: 255 }).notNull(),
  requiredQuantity: integer('required_quantity').notNull().default(1),
});

export const kits = pgTable('kits', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'set null',
  }),
  status: kitStatusEnum('status').notNull().default('active'),
  templateId: uuid('template_id').references(() => kitTemplates.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  kitId: uuid('kit_id').references(() => kits.id, { onDelete: 'cascade' }),
  supplyId: uuid('supply_id').references(() => supplies.id, { onDelete: 'set null' }),
  freeformName: text('freeform_name'),
  supplyName: varchar('supply_name', { length: 255 }).notNull(),
  supplyCategoryId: uuid('supply_category_id').references(() => supplyCategories.id, {
    onDelete: 'set null',
  }),
  locationId: uuid('location_id').references(() => locations.id, {
    onDelete: 'set null',
  }),
  requiredQuantity: integer('required_quantity'),
  actualQuantity: integer('actual_quantity'),
  status: inventoryItemStatusEnum('status').notNull().default('missing'),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kitAcl = pgTable(
  'kit_acl',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kitId: uuid('kit_id')
      .notNull()
      .references(() => kits.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: permissionLevelEnum('permission').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('kit_acl_kit_user_unique').on(t.kitId, t.userId)],
);

export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  kitId: uuid('kit_id')
    .notNull()
    .references(() => kits.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  linkToken: varchar('link_token', { length: 255 }).notNull().unique(),
  permission: varchar('permission', { length: 10 }).notNull().default('view'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade',
  }),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const revenuecatCustomers = pgTable('revenuecat_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  appUserId: varchar('app_user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
