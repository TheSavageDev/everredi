# Running Database Redesign Migrations

The database redesign migrations (012-022) have been created. Here are the ways to run them:

## ⚠️ Important: Large Data Migrations

Some migrations (especially 013, 015, 017) process existing data and may take several minutes. If you encounter timeouts, use **Option 1** (Supabase SQL Editor) which is more reliable for long-running operations.

## Option 1: Supabase SQL Editor (Recommended - No Timeout Issues)

This is the **most reliable** method for large data migrations:

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `migrations-combined-redesign.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)

The SQL Editor has longer timeouts and better error handling for large operations.

## Option 2: Batched psql Script (Better Timeout Handling)

If you have the database password, use the batched script which has longer timeouts:

```bash
cd api
npm run migrate:redesign
```

**First, get your database password:**

1. Go to Supabase Dashboard → Your Project
2. Go to **Project Settings** → **Database**
3. Find the **Connection string** section
4. Copy the password from the connection string (format: `postgresql://postgres:[PASSWORD]@...`)
5. Add to `.env.development`:
   ```
   SUPABASE_DB_PASSWORD=your-password-here
   ```

The batched script:
- Runs migrations one at a time
- Has 10-minute timeout per migration
- Shows progress for each step
- Handles errors gracefully

## Option 3: Run Individual Migrations

If you're still getting timeouts, run migrations individually:

1. Open `api/migrations/012_add_tenants_and_containers.sql` in Supabase SQL Editor
2. Run it
3. Wait for completion
4. Repeat for 013, 014, etc. in order

This gives you more control and you can see progress for each phase.

## Migration Phases

The migrations are organized in phases:

- **012-013**: Foundation (tenants, containers) - Fast
- **014-015**: Inventory lots - May take time if you have many inventory items
- **016-017**: Kit requirements - May take time if you have many kit items
- **018**: Template revisions - Fast
- **019**: Transactions - Fast (no data migration)
- **020**: Kit ACL - Fast
- **021**: Notifications - May take time if you have many notifications
- **022**: Supply scoping - Fast

## Verification

After running migrations, verify they worked:

```sql
-- Check that new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tenants', 'containers', 'kits', 'inventory_lots', 'kit_requirements')
ORDER BY table_name;

-- Check migration tracking
SELECT * FROM schema_migrations WHERE version >= '012' ORDER BY applied_at;

-- Check data migration (should have same count)
SELECT 
  (SELECT COUNT(*) FROM user_kits) as old_kits,
  (SELECT COUNT(*) FROM containers WHERE type = 'kit') as new_containers;
```

## Troubleshooting

### Timeout Errors

If you get timeouts:
1. **Use Supabase SQL Editor** - It has much longer timeouts
2. **Run migrations individually** - See which one is timing out
3. **Check your data size** - Large datasets take longer

### "relation already exists" Errors

Some tables may already exist. The migrations use `CREATE TABLE IF NOT EXISTS` so this is usually safe to ignore.

### "column already exists" Errors

Some columns may have been added manually. Check the migration file and comment out the conflicting ALTER TABLE statements if needed.

### Connection Errors

- Verify `SUPABASE_DB_PASSWORD` is correct
- Check your network connection
- Ensure Supabase project is active (not paused)

## Important Notes

- **Backup First**: Always backup your database before running migrations
- **Test Environment**: Run on a test/staging environment first
- **Backward Compatibility**: Old tables (`user_kits`, `kit_items`) are kept for backward compatibility
- **Data Migration**: Existing data is automatically migrated to the new schema
- **No Data Loss**: All existing data is preserved during migration
