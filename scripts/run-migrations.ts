#!/usr/bin/env ts-node
/**
 * Run database migrations in order
 *
 * Usage:
 *   npm run migrate
 *   ts-node -r tsconfig-paths/register scripts/run-migrations.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
// Try .env.development first, then fall back to .env
const envFile =
  process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
    ? '.env.development'
    : '.env';
config({ path: resolve(__dirname, `../${envFile}`) });
// Also load .env as fallback for any missing variables
config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SECRET_KEY');
  console.error(`\n   Loaded from: ${envFile}`);
  process.exit(1);
}

console.log(`📋 Using environment file: ${envFile}`);
console.log(`📋 Supabase URL: ${SUPABASE_URL.substring(0, 30)}...\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Migration tracking table
const MIGRATIONS_TABLE = 'schema_migrations';

interface Migration {
  version: string;
  name: string;
  applied_at: string;
}

async function ensureMigrationsTable(): Promise<void> {
  // Check if migrations table exists
  const { error: checkError } = await supabase
    .from(MIGRATIONS_TABLE)
    .select('version')
    .limit(1);

  if (checkError) {
    // Table doesn't exist, create it
    console.log('📋 Creating migrations tracking table...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        version VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (error) {
      // Try direct SQL execution via REST API
      console.log(
        '⚠️  Could not create migrations table via RPC, trying direct SQL...',
      );
      // For Supabase, we'll need to use the REST API or run SQL directly
      // This is a limitation - we'll track migrations in a simpler way
      console.log(
        '⚠️  Please create the migrations table manually in Supabase SQL editor:',
      );
      console.log(createTableSQL);
    }
  }
}

async function getAppliedMigrations(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from(MIGRATIONS_TABLE)
      .select('version');

    if (error) {
      console.warn('⚠️  Could not fetch applied migrations:', error.message);
      return new Set();
    }

    return new Set((data || []).map((m: Migration) => m.version));
  } catch (error) {
    console.warn('⚠️  Error fetching applied migrations:', error);
    return new Set();
  }
}

async function recordMigration(version: string, name: string): Promise<void> {
  try {
    await supabase.from(MIGRATIONS_TABLE).insert({
      version,
      name,
      applied_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(`⚠️  Could not record migration ${version}:`, error);
  }
}

async function runMigration(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  const version = fileName.split('_')[0]; // Extract version number

  console.log(`\n📄 Running migration: ${fileName}`);

  const sql = fs.readFileSync(filePath, 'utf-8');

  // Split SQL by semicolons and execute each statement
  // Note: Supabase doesn't have a direct SQL execution RPC by default
  // We'll need to use the REST API or execute via psql
  // For now, we'll log the SQL and require manual execution

  console.log('⚠️  Supabase client does not support direct SQL execution.');
  console.log(
    '⚠️  Please run this migration manually in the Supabase SQL editor:',
  );
  console.log(`\n--- ${fileName} ---\n${sql}\n---\n`);

  // Try to execute via REST API if possible
  // This is a workaround - in production, you'd use Supabase's migration system
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_SECRET_KEY || '',
    Authorization: `Bearer ${SUPABASE_SECRET_KEY || ''}`,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    console.error(`❌ Migration ${fileName} failed. Please run manually.`);
    console.error(`   Error: ${await response.text()}`);
    throw new Error(`Migration ${fileName} failed`);
  }

  console.log(`✅ Migration ${fileName} completed`);
  await recordMigration(version, fileName);
}

async function main(): Promise<void> {
  console.log('🚀 Starting database migrations...\n');

  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('❌ No migration files found in migrations/ directory');
    process.exit(1);
  }

  console.log(`📦 Found ${files.length} migration files\n`);

  await ensureMigrationsTable();
  const appliedMigrations = await getAppliedMigrations();

  for (const file of files) {
    const version = file.split('_')[0];
    if (appliedMigrations.has(version)) {
      console.log(`⏭️  Skipping ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    try {
      await runMigration(filePath);
    } catch (error) {
      console.error(`\n❌ Migration failed: ${file}`);
      console.error(error);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations completed successfully!');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
}
