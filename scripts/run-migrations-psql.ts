#!/usr/bin/env ts-node
/**
 * Run database migrations using psql
 * 
 * This script executes SQL migrations directly against the PostgreSQL database
 * using psql, which requires the database connection string.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." npm run migrate:psql
 *   Or set SUPABASE_URL and SUPABASE_DB_PASSWORD in .env
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

// Construct database URL from Supabase URL if not provided
function getDatabaseUrl(): string {
  if (DATABASE_URL) {
    return DATABASE_URL;
  }

  if (!SUPABASE_URL) {
    throw new Error('Either DATABASE_URL or SUPABASE_URL must be set');
  }

  // Extract project ref from Supabase URL
  // Format: https://<project-ref>.supabase.co
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
    throw new Error('SUPABASE_DB_PASSWORD must be set to connect to database. Get it from Supabase Dashboard → Project Settings → Database → Connection string');
  }

  return `postgresql://${dbUser}:${SUPABASE_DB_PASSWORD}@${dbHost}:${dbPort}/${dbName}`;
}

async function ensureMigrationsTable(dbUrl: string): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  try {
    execSync(`psql "${dbUrl}" -c "${createTableSQL.replace(/\n/g, ' ')}"`, {
      stdio: 'inherit',
    });
    console.log('✅ Migrations table ready');
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error);
    throw error;
  }
}

function getAppliedMigrations(dbUrl: string): Set<string> {
  try {
    const result = execSync(
      `psql "${dbUrl}" -t -c "SELECT version FROM schema_migrations;"`,
      { encoding: 'utf-8' }
    );
    const versions = result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return new Set(versions);
  } catch (error) {
    console.warn('⚠️  Could not fetch applied migrations, assuming none:', error);
    return new Set();
  }
}

function recordMigration(dbUrl: string, version: string, name: string): void {
  try {
    const sql = `INSERT INTO schema_migrations (version, name) VALUES ('${version}', '${name}') ON CONFLICT (version) DO NOTHING;`;
    execSync(`psql "${dbUrl}" -c "${sql}"`, { stdio: 'inherit' });
  } catch (error) {
    console.warn(`⚠️  Could not record migration ${version}:`, error);
  }
}

function runMigration(dbUrl: string, filePath: string): void {
  const fileName = path.basename(filePath);
  const version = fileName.split('_')[0];

  console.log(`\n📄 Running migration: ${fileName}`);

  try {
    // Read SQL file
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute via psql
    execSync(`psql "${dbUrl}" -f "${filePath}"`, {
      stdio: 'inherit',
    });

    console.log(`✅ Migration ${fileName} completed`);
    recordMigration(dbUrl, version, fileName);
  } catch (error) {
    console.error(`❌ Migration ${fileName} failed:`, error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting database migrations with psql...\n');

  const dbUrl = getDatabaseUrl();
  console.log(`📋 Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}\n`);

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

  await ensureMigrationsTable(dbUrl);
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
