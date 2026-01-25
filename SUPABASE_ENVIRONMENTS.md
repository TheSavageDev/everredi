# Supabase Environment Setup Guide

This guide explains how to set up separate Supabase environments (development, staging, production) to keep your data isolated.

## Overview

Supabase projects are completely isolated from each other. Each project has its own:

- Database (PostgreSQL)
- Authentication users
- Storage buckets
- Edge Functions
- API keys

**Best Practice**: Create separate Supabase projects for each environment (dev, staging, production).

## Setup Steps

### 1. Create Separate Supabase Projects

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create three separate projects:
   - **Development**: `your-app-dev` (or `your-app-development`)
   - **Staging**: `your-app-staging`
   - **Production**: `your-app-prod` (or `your-app-production`)

### 2. Get Environment-Specific Credentials

For each project, you'll need:

1. **Project URL**: Found in Project Settings → API
   - Format: `https://xxxxx.supabase.co`

2. **Service Role Key** (for backend/admin operations):
   - Found in Project Settings → API → Service Role Key
   - New format: `sb_secret_...` (or legacy `service_role` key)
   - ⚠️ **Keep this secret!** Never expose it to the frontend.

3. **Publishable Key** (for frontend/client operations):
   - Found in Project Settings → API → Publishable Key
   - New format: `sb_publishable_...` (or legacy `anon` key)
   - Safe to use in frontend code
   - Note: Backend typically only needs the Service Role Key

### 3. Configure Environment Variables

Update your `.env` files for each environment:

#### Development (`.env.development` or `.env.local`)

```bash
# Supabase Development
SUPABASE_URL=https://xxxxx-dev.supabase.co
# Service Role Key (backend/admin operations)
# New format: sb_secret_... or legacy service_role key
SUPABASE_SECRET_KEY=sb_secret_xxxxx... # or legacy key
# Publishable Key (frontend/client operations - optional for backend)
# New format: sb_publishable_... or legacy anon key
# SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx...
```

#### Staging (`.env.staging`)

```bash
# Supabase Staging
SUPABASE_URL=https://xxxxx-staging.supabase.co
# Service Role Key (backend/admin operations)
# New format: sb_secret_... or legacy service_role key
SUPABASE_SECRET_KEY=sb_secret_xxxxx... # or legacy key
# Publishable Key (frontend/client operations - optional for backend)
# SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx...
```

#### Production (`.env.production`)

```bash
# Supabase Production
SUPABASE_URL=https://xxxxx-prod.supabase.co
# Service Role Key (backend/admin operations)
# New format: sb_secret_... or legacy service_role key
SUPABASE_SECRET_KEY=sb_secret_xxxxx... # or legacy key
# Publishable Key (frontend/client operations - optional for backend)
# SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx...
```

### 4. Apply Migrations to Each Environment

After creating your migration files, apply them to each environment:

```bash
# Development
SUPABASE_URL=https://xxxxx-dev.supabase.co \
SUPABASE_SECRET_KEY=dev-key \
npm run migrate

# Staging
SUPABASE_URL=https://xxxxx-staging.supabase.co \
SUPABASE_SECRET_KEY=staging-key \
npm run migrate

# Production
SUPABASE_URL=https://xxxxx-prod.supabase.co \
SUPABASE_SECRET_KEY=prod-key \
npm run migrate
```

### 5. Environment-Specific Configuration in Code

Your NestJS app already uses `ConfigService` to read environment variables, so it will automatically use the correct Supabase project based on your `.env` file.

```typescript
// This already works - no code changes needed!
// The backend uses SUPABASE_SECRET_KEY (service role key)
// Format: sb_secret_... (new) or legacy service_role key
const supabaseUrl = this.config.get<string>('SUPABASE_URL');
const supabaseServiceRoleKey = this.config.get<string>('SUPABASE_SECRET_KEY');
```

## Deployment Configuration

### Google Cloud Build

Update your `cloudbuild.*.yaml` files to use environment-specific secrets:

```yaml
# cloudbuild.staging.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/api-staging', '.']
    env:
      - 'SUPABASE_URL=${_SUPABASE_URL}'
      - 'SUPABASE_SECRET_KEY=${_SUPABASE_SECRET_KEY}'
substitutions:
  _SUPABASE_URL: 'https://xxxxx-staging.supabase.co'
  # _SUPABASE_SECRET_KEY should be stored in Secret Manager
```

### Secret Manager (Recommended)

Store your Supabase keys in Google Cloud Secret Manager:

```bash
# Create secrets for each environment
gcloud secrets create supabase-url-staging --data-file=- <<< "https://xxxxx-staging.supabase.co"
gcloud secrets create supabase-secret-key-staging --data-file=- <<< "your-staging-service-role-key"
gcloud secrets create supabase-url-prod --data-file=- <<< "https://xxxxx-prod.supabase.co"
gcloud secrets create supabase-secret-key-prod --data-file=- <<< "your-prod-service-role-key"
```

Then reference them in your Cloud Build config:

```yaml
availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/supabase-url-staging/versions/latest
      env: 'SUPABASE_URL'
    - versionName: projects/$PROJECT_ID/secrets/supabase-secret-key-staging/versions/latest
      env: 'SUPABASE_SECRET_KEY'
```

## Database Schema Management

### Option 1: Manual Migration (Current Approach)

Run migrations manually on each environment using the `run-migrations.ts` script.

### Option 2: Supabase CLI (Recommended for Production)

Use the Supabase CLI for better migration management:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## Testing Strategy

1. **Local Development**: Use a local Supabase instance or dev project
2. **CI/CD Testing**: Use a dedicated test Supabase project
3. **Staging**: Mirror production schema, use test data
4. **Production**: Real user data, production schema

## Data Isolation Benefits

✅ **Complete isolation**: Dev/test data never touches production
✅ **Independent scaling**: Each environment can scale independently
✅ **Safe testing**: Test migrations and features without risk
✅ **Easy rollback**: If staging breaks, production is unaffected
✅ **Cost control**: Pause/delete dev/staging projects when not needed

## Cost Considerations

- **Free Tier**: Each Supabase project gets 500MB database, 1GB file storage
- **Development**: Usually fine on free tier
- **Staging**: May need paid tier if testing with large datasets
- **Production**: Will need paid tier as you scale

You can pause projects to save costs (they'll be paused after 1 week of inactivity on free tier).

## Best Practices

1. **Never use production credentials in development**
2. **Use different project names** to avoid confusion
3. **Document which project is which** in your team wiki
4. **Set up alerts** for production project usage
5. **Regular backups** of production (Supabase handles this, but verify)
6. **Test migrations on staging first** before applying to production

## Troubleshooting

### "Invalid API key" errors

- Verify you're using the correct project's keys
- Check that the key type matches (Service Role/Secret for backend, Publishable for frontend)
- Note: Supabase has moved to new key formats:
  - **New**: `sb_secret_...` (replaces `service_role` key)
  - **New**: `sb_publishable_...` (replaces `anon` key)
  - **Legacy keys still work** but will be deprecated in late 2026

### "Connection refused" errors

- Verify the SUPABASE_URL is correct
- Check if the project is paused (free tier projects pause after inactivity)

### Migration errors

- Always test migrations on dev/staging first
- Check that you're connected to the right project
- Verify database permissions

## API Key Migration (2024-2026)

Supabase is transitioning to new API key formats:

- **New Format** (Recommended):
  - `sb_secret_...` - Replaces `service_role` key (backend/admin)
  - `sb_publishable_...` - Replaces `anon` key (frontend/client)

- **Legacy Format** (Still Supported):
  - `service_role` key - Will be deprecated in late 2026
  - `anon` key - Will be deprecated in late 2026

**Timeline:**

- October 2025: Automatic migration of JWT secrets (no action needed)
- November 2025: Periodic reminders to transition
- Late 2026: Legacy keys will be deprecated

**Action:** Update your keys to the new format when convenient. Both formats work until late 2026.

## Additional Resources

- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
- [Supabase Multi-Environment Setup](https://supabase.com/docs/guides/cli/local-development#multiple-environments)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Supabase Project Management](https://supabase.com/docs/guides/platform/managing-projects)
