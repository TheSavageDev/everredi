# Firebase to Supabase Migration - API Plan

> **⚠️ HISTORICAL DOCUMENT**  
> This migration has been completed. This document is kept for historical reference only.  
> For current API setup, see `api/README.md` and `api/DEPLOYMENT.md`.  
> For database schema, see `DATABASE_SCHEMA.md` and `api/migrations/README.md`.

## Overview

Migrate the NestJS backend API from Firebase (Firestore + Auth) to Supabase (PostgreSQL + Supabase Auth). This addresses inefficient nested subcollection queries (O(n*m*k) complexity) and provides proper relational database capabilities.

## Current Stack

- NestJS + Firebase Admin SDK (Firestore + Auth)
- Firestore (NoSQL, nested subcollections)
- Firebase Authentication

## Target Stack

- NestJS + Supabase JS Client (PostgreSQL + Auth)
- PostgreSQL (relational, proper joins)
- Supabase Auth (JWT-based)

## Phase 1: Database Schema Design

### Core Tables

1. **users** - User accounts
   - `id` (UUID, primary key)
   - `email` (unique)
   - `display_name`
   - `avatar_url`
   - `subscription_tier` (free/premium)
   - `subscription_status` (active/cancelled/expired)
   - `subscription_expires_at` (timestamp)
   - `stripe_customer_id`
   - `referral_code` (unique)
   - `referred_by` (FK to users.id)
   - `is_admin` (boolean)
   - `onboarding_completed` (boolean)
   - `created_at`, `updated_at`, `last_login_at`

2. **locations** - User locations
   - `id` (UUID, primary key)
   - `user_id` (FK to users.id)
   - `name`
   - `address`
   - `created_at`, `updated_at`

3. **user_kits** - User's emergency kits
   - `id` (UUID, primary key)
   - `user_id` (FK to users.id)
   - `name`
   - `location_id` (FK to locations.id)
   - `location_name` (denormalized for performance)
   - `status` (active/incomplete/complete/archived)
   - `notes`
   - `kit_template_id` (optional FK)
   - `created_at`, `updated_at`

4. **kit_items** - Items within kits
   - `id` (UUID, primary key)
   - `user_kit_id` (FK to user_kits.id)
   - `supply_id` (FK to supplies.id)
   - `supply_name` (denormalized)
   - `required_quantity` (integer)
   - `actual_quantity` (integer)
   - `status` (missing/partial/complete)
   - `notes`
   - `created_at`, `updated_at`

5. **shared_kits** - Kit sharing relationships (CRITICAL - solves the query problem!)
   - `id` (UUID, primary key)
   - `kit_id` (FK to user_kits.id)
   - `owner_id` (FK to users.id)
   - `shared_with_user_id` (FK to users.id)
   - `permission` (view/edit)
   - `shared_at` (timestamp)
   - `created_at` (timestamp)
   - **Index**: `(shared_with_user_id)` for fast lookups
   - **Unique constraint**: `(kit_id, shared_with_user_id)` to prevent duplicates

   **Why Separate Table:**
   - Per-user permissions (each user can have different permission levels)
   - Per-user timestamps (track when each user was granted access)
   - Efficient queries: `WHERE shared_with_user_id = $1` with B-tree index = O(log n)
   - Business scalability: Each share is independent, queries stay fast for 10-100+ users
   - Foreign key constraints ensure data integrity
   - Easy to add per-share settings (notifications, expiration dates, etc.)

6. **inventory_items** - User inventory
   - `id` (UUID, primary key)
   - `user_id` (FK to users.id)
   - `supply_id` (optional FK)
   - `supply_name`
   - `location_id` (FK to locations.id)
   - `kit_id` (optional FK)
   - `quantity`
   - `expiration_date`
   - `purchase_date`
   - `status` (active/expired/used/disposed)
   - `created_at`, `updated_at`

7. **supplies** - Curated supply catalog
   - `id` (UUID, primary key)
   - `name`
   - `category_id` (FK)
   - `description`
   - `created_at`, `updated_at`

8. **kit_templates** - Template kits
   - `id` (UUID, primary key)
   - `user_id` (FK to users.id, nullable for public)
   - `name`
   - `description`
   - `is_public` (boolean)
   - `created_at`, `updated_at`

9. Additional tables: `supply_categories`, `teams`, `notifications`, `custom_fields`, etc.

### Key Improvements

- **Shared kits query**: `SELECT * FROM shared_kits WHERE shared_with_user_id = $1` (O(log n) with B-tree index vs O(n*m*k) in Firestore)
- **Business sharing**: Efficiently handle kits shared with 10-100+ users - each share is independent
- **Per-user permissions**: Each user can have different permission levels (view vs edit)
- **Per-user timestamps**: Track when each individual user was granted access
- **Proper foreign keys**: Data integrity on all relationships
- **Joins**: Efficient relational queries with proper indexes
- **Transactions**: ACID compliance for complex operations

## Phase 2: Supabase Setup

### 2.1 Create Supabase Module

**Files to create:**

- `api/src/config/supabase.module.ts` - Supabase module
- `api/src/config/supabase.provider.ts` - Dependency injection tokens

**Files to modify:**

- `api/package.json` - Add `@supabase/supabase-js`
- `api/src/app.module.ts` - Replace `FirebaseModule` with `SupabaseModule`

**Environment variables to add:**

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SECRET_KEY` - Service role key for admin operations
  - New format: `sb_secret_...` (recommended)
  - Legacy format: `service_role` key (still supported until late 2026)
  - Found in: Project Settings → API → Service Role Key

**Implementation:**

- Create Supabase client with connection pooling
- Export Supabase client as injectable provider
- Handle connection errors gracefully

### 2.2 Replace Auth Guard

**Files to modify:**

- `api/src/common/guards/firebase-auth.guard.ts` → `supabase-auth.guard.ts`

**Changes:**

- Verify Supabase JWT tokens instead of Firebase tokens
- Extract user ID from JWT payload (`sub` claim)
- Maintain same interface for controllers (extract `uid` from token)
- Update error messages if needed

**Files that use the guard:**

- All controllers using `@UseGuards(FirebaseAuthGuard)`
- Update imports to use `SupabaseAuthGuard`

## Phase 3: Service Migrations

### Priority Order

1. **Users Service** (`api/src/users/users.service.ts`)
   - Replace Firestore queries with Supabase SQL
   - Update `getUserById`: `SELECT * FROM users WHERE id = $1`
   - Update `createOrUpdateUser`: Use `INSERT ... ON CONFLICT`
   - Update `getSubscriptionStatus`: Join with subscription tables if needed
   - Use Supabase RPC for complex queries if needed
   - Remove `@Inject(FIRESTORE)` dependency

2. **Sharing Service** (`api/src/sharing/sharing.service.ts`) - **CRITICAL PATH**
   - **Critical fix**: Replace nested subcollection query with:

     ```sql
     SELECT sk.*, uk.name as kit_name
     FROM shared_kits sk
     JOIN user_kits uk ON uk.id = sk.kit_id
     WHERE sk.shared_with_user_id = $1
     ```

     (Requires B-tree index on `shared_with_user_id` for O(log n) performance)

   - Update `shareKitWithUser` to use simple INSERT:

     ```sql
     INSERT INTO shared_kits (kit_id, owner_id, shared_with_user_id, permission, shared_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (kit_id, shared_with_user_id) DO UPDATE
     SET permission = EXCLUDED.permission,
         updated_at = NOW()
     ```

   - Update `getSharedKits` to use indexed foreign key lookup
   - Update `removeSharedKit` to use simple DELETE:
     ```sql
     DELETE FROM shared_kits
     WHERE kit_id = $1 AND shared_with_user_id = $2
     ```
   - Remove `@Inject(FIRESTORE)` dependency

3. **User Kits Service** (`api/src/kits/user-kits.service.ts`)
   - Migrate kit CRUD operations
   - Update `getkitItems` to use JOIN instead of nested queries:
     ```sql
     SELECT * FROM kit_items WHERE user_kit_id = $1
     ```
   - Use transactions for bulk operations (e.g., `bulkUpdateKitItemsToRequiredQuantity`)
   - Handle shared kits: Join with `shared_kits` table
   - Remove `@Inject(FIRESTORE)` dependency

4. **Inventory Service** (`api/src/inventory/inventory.service.ts`)
   - Migrate inventory item operations
   - Use proper foreign keys
   - Remove `@Inject(FIRESTORE)` dependency

5. **Remaining Services** (in order):
   - Locations (`api/src/locations/locations.service.ts`)
   - Supplies (`api/src/supplies/supplies.service.ts`)
   - Kit Templates (`api/src/kits/kit-templates.service.ts`)
   - Notifications (`api/src/notifications/notifications.service.ts`)
   - Teams (`api/src/teams/teams.service.ts`)
   - Analytics (`api/src/analytics/analytics.service.ts`)
   - Compliance (`api/src/compliance/compliance.service.ts`)
   - Custom Fields (`api/src/custom-fields/custom-fields.service.ts`)
   - All other services

### Service Migration Pattern

For each service:

1. Replace `@Inject(FIRESTORE)` with `@Inject(SUPABASE)`
2. Convert Firestore queries to SQL:
   - `collection().doc().get()` → `SELECT * FROM table WHERE id = $1`
   - `collection().where().get()` → `SELECT * FROM table WHERE condition`
   - `collection().add()` → `INSERT INTO table ...`
   - `doc().update()` → `UPDATE table SET ... WHERE id = $1`
   - `doc().delete()` → `DELETE FROM table WHERE id = $1`
3. Handle nested subcollections by using JOINs
4. Use transactions for multi-step operations
5. Update error handling for PostgreSQL errors

## Phase 4: Data Migration Scripts

### 4.1 Export Script

**File to create:** `api/scripts/export-firestore-data.ts`

**Functionality:**

- Export all Firestore collections to JSON files
- Handle nested subcollections (userKits → kitItems, sharedWith)
- Preserve relationships and IDs
- Export to `api/scripts/migration-data/` directory

**Collections to export:**

- users
- locations (nested under users)
- userKits (nested under users)
- kitItems (nested under userKits)
- sharedWith (nested under userKits)
- inventoryItems (nested under users)
- supplies
- supplyCategories
- kitTemplates (nested under users)
- All other collections

### 4.2 Transform Script

**File to create:** `api/scripts/transform-to-postgres.ts`

**Functionality:**

- Transform Firestore documents to PostgreSQL rows
- Flatten nested subcollections:
  - `users/{userId}/userKits/{kitId}/sharedWith/{shareId}` → `shared_kits` table
  - `users/{userId}/userKits/{kitId}/kitItems/{itemId}` → `kit_items` table
- Generate UUIDs for all IDs (or preserve if already UUIDs)
- Map Firestore Timestamps to PostgreSQL timestamps
- Handle null values and defaults
- Output SQL INSERT statements or JSON for import script

### 4.3 Import Script

**File to create:** `api/scripts/import-to-supabase.ts`

**Functionality:**

- Use Supabase client to insert data
- Handle foreign key relationships (insert in correct order)
- Use transactions for data integrity
- Batch inserts for performance
- Verify row counts match exported data
- Handle errors and retries

**Import order:**

1. users
2. locations
3. supplies, supply_categories
4. user_kits
5. kit_items
6. shared_kits
7. inventory_items
8. kit_templates
9. All other tables

### 4.4 Migration Validation

**File to create:** `api/scripts/validate-migration.ts`

**Functionality:**

- Compare record counts between Firestore and Supabase
- Spot-check data integrity (random samples)
- Verify relationships (foreign keys)
- Test critical queries (shared kits, user kits, etc.)
- Generate validation report

## Phase 5: Testing

### 5.1 Unit Tests

- Update all service unit tests to use Supabase mocks
- Test SQL queries return expected results
- Test error handling

### 5.2 Integration Tests

- Update E2E tests to use Supabase test database
- Test auth guard with Supabase tokens
- Test all CRUD operations
- Test sharing feature (critical path)
- Test transactions

### 5.3 Performance Testing

- Benchmark shared kits query (should be <100ms)
- Compare query performance before/after
- Test with large datasets (100+ shared users)

## Phase 6: Deployment

### 6.1 Staging Deployment

1. Create Supabase staging project
2. Run schema migrations
3. Run data migration scripts
4. Deploy updated API to staging
5. Test all features
6. Performance benchmarks

### 6.2 Production Migration

1. Create Supabase production project
2. Export production Firestore data
3. Run data migration during maintenance window
4. Deploy updated API
5. Monitor for issues
6. Keep Firebase for 30 days as backup

### 6.3 Rollback Plan

- Keep Firebase infrastructure for 30 days
- Ability to switch back via environment variable
- Data sync script if needed

## Phase 7: Cleanup

- Remove `firebase-admin` dependency
- Remove Firestore code
- Update documentation
- Update deployment configs
- Archive Firebase project (after verification period)

## Dependencies

- **Frontend (Mobile)**: Must update to use Supabase auth tokens
- **Web App**: Must update to use Supabase auth tokens
- **Supabase Project**: Must be created and configured before migration

## Estimated Timeline

- **Phase 1** (Schema Design): 2-3 days
- **Phase 2** (Supabase Setup): 1-2 days
- **Phase 3** (Service Migrations): 2-3 weeks
- **Phase 4** (Data Migration Scripts): 3-5 days
- **Phase 5** (Testing): 1-2 weeks
- **Phase 6** (Deployment): 2-3 days
- **Phase 7** (Cleanup): 2-3 days

**Total: 6-8 weeks**

## Success Criteria

- All existing features work with Supabase
- Shared kits query is <100ms (vs current O(n*m*k))
- Zero data loss during migration
- All tests pass
- Performance equal or better than Firestore
