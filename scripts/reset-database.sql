-- =========================
-- Database Reset Script
-- =========================
-- WARNING: This will DELETE ALL DATA in the database
-- Only run this in development/staging environments
-- 
-- This script:
-- 1. Drops all tables, views, functions, and types
-- 2. Clears the schema_migrations table
-- 3. Allows you to start fresh with migrations
--
-- Usage: Run this in Supabase SQL Editor, then run all migrations from scratch

-- =========================
-- Step 1: Drop all views
-- =========================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
END $$;

-- =========================
-- Step 2: Drop all tables (CASCADE will handle foreign keys)
-- =========================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('schema_migrations') -- Keep migrations table for now
    ) 
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- =========================
-- Step 3: Drop all custom types/enums
-- =========================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT typname 
        FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND typtype = 'e' -- Only enums
    ) 
    LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

-- =========================
-- Step 4: Drop all functions
-- =========================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) 
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.argtypes || ') CASCADE';
    END LOOP;
END $$;

-- =========================
-- Step 5: Clear schema_migrations (optional - comment out if you want to keep migration history)
-- =========================
-- TRUNCATE TABLE schema_migrations;

-- =========================
-- Step 6: Drop schema_migrations table (optional - uncomment if you want a completely fresh start)
-- =========================
-- DROP TABLE IF EXISTS schema_migrations CASCADE;

-- =========================
-- Verification
-- =========================
-- After running this, verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Should return empty or only schema_migrations if you kept it
