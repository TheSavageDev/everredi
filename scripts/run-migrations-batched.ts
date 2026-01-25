#!/usr/bin/env ts-node
/**
 * Run database migrations in smaller batches to avoid timeouts
 * 
 * This script runs migrations one at a time with progress tracking
 * to avoid server timeouts on large data migrations.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Load environment variables
const envFile = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
  ? '.env.development'
  : '.env';
config({ path: resolve(__dirname, `../${envFile}`) });
config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

function getDatabaseUrl(): string {
  if (DATABASE_URL) {
    return DATABASE_URL;
  }

  if (!SUPABASE_URL) {
    throw new Error('Either DATABASE_URL or SUPABASE_URL must be set');
  }

  const match = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error(`Invalid SUPABASE_URL format: ${SUPABASE_URL}`);
  }

  const projectRef = match[1];
  const dbHost = `${projectRef}.supabase.co`;
  const dbPort = 5432;
  const dbName = 'postgres';
  const dbUser = 'postgres';

  if (!SUPABASE_DB_PASSWORD) {
    throw new Error('SUPABASE_DB_PASSWORD must be set. Get it from Supabase Dashboard → Project Settings → Database → Connection string');
  }

  return `postgresql://${dbUser}:${SUPABASE_DB_PASSWORD}@${dbHost}:${dbPort}/${dbName}`;
}

function ensureMigrationsTable(dbUrl: string): void {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  try {
    execSync(`psql "${dbUrl}" -c "${createTableSQL.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, {
      stdio: 'inherit',
      timeout: 30000, // 30 second timeout
    });
    console.log('✅ Migrations table ready');
  } catch (error: any) {
    if (error.message?.includes('timeout')) {
      console.error('❌ Connection timeout. Check your database credentials and network.');
    } else {
      console.error('❌ Failed to create migrations table:', error.message);
    }
    throw error;
  }
}

function getAppliedMigrations(dbUrl: string): Set<string> {
  try {
    const result = execSync(
      `psql "${dbUrl}" -t -c "SELECT version FROM schema_migrations;"`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    const versions = result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return new Set(versions);
  } catch (error) {
    console.warn('⚠️  Could not fetch applied migrations, assuming none');
    return new Set();
  }
}

function recordMigration(dbUrl: string, version: string, name: string): void {
  try {
    const sql = `INSERT INTO schema_migrations (version, name) VALUES ('${version}', '${name.replace(/'/g, "''")}') ON CONFLICT (version) DO NOTHING;`;
    execSync(`psql "${dbUrl}" -c "${sql}"`, { 
      stdio: 'inherit',
      timeout: 10000 
    });
  } catch (error) {
    console.warn(`⚠️  Could not record migration ${version}`);
  }
}

function runMigration(dbUrl: string, filePath: string): void {
  const fileName = path.basename(filePath);
  const version = fileName.split('_')[0];

  console.log(`\n📄 Running migration: ${fileName}`);
  console.log(`   This may take a while for data migrations...`);

  try {
    // Use -f flag to read from file (more reliable than piping)
    // Add connection timeout and statement timeout
    const psqlCommand = `psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${filePath}"`;
    
    execSync(psqlCommand, {
      stdio: 'inherit',
      timeout: 600000, // 10 minute timeout per migration
      env: {
        ...process.env,
        PGCONNECT_TIMEOUT: '10',
      },
    });

    console.log(`✅ Migration ${fileName} completed`);
    recordMigration(dbUrl, version, fileName);
  } catch (error: any) {
    if (error.message?.includes('timeout')) {
      console.error(`\n❌ Migration ${fileName} timed out after 10 minutes`);
      console.error(`   This migration may be processing a large amount of data.`);
      console.error(`   Consider running it directly in Supabase SQL Editor.`);
    } else {
      console.error(`\n❌ Migration ${fileName} failed:`, error.message);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting database migrations (batched to avoid timeouts)...\n');

  const dbUrl = getDatabaseUrl();
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`📋 Database: ${maskedUrl}\n`);

  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f.match(/^0(1[2-9]|2[0-2])_/)) // Only redesign migrations 012-022
    .sort();

  if (files.length === 0) {
    console.error('❌ No redesign migration files found (012-022)');
    process.exit(1);
  }

  console.log(`📦 Found ${files.length} redesign migration files\n`);

  try {
    ensureMigrationsTable(dbUrl);
  } catch (error) {
    console.error('\n❌ Failed to connect to database. Please check:');
    console.error('   1. SUPABASE_DB_PASSWORD is set correctly');
    console.error('   2. Your network connection');
    console.error('   3. Supabase project is active\n');
    console.error('   Alternative: Run migrations in Supabase SQL Editor');
    console.error('   See: api/RUN_REDESIGN_MIGRATIONS.md\n');
    process.exit(1);
  }

  const appliedMigrations = getAppliedMigrations(dbUrl);

  for (const file of files) {
    const version = file.split('_')[0];
    if (appliedMigrations.has(version)) {
      console.log(`⏭️  Skipping ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    try {
      runMigration(dbUrl, filePath);
      // Small delay between migrations
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`\n❌ Migration failed: ${file}`);
      console.error('\n💡 Tip: For large data migrations, consider running them');
      console.error('   directly in Supabase SQL Editor to avoid timeouts.\n');
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations completed successfully!');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Migration script failed:', error.message);
    process.exit(1);
  });
}
