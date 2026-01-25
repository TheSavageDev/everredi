# Cloud Run Deployment Guide

This document describes how to deploy the Everredi backend to Google Cloud Run using Cloud Build CI/CD.

## Architecture

- **Single GCP Project**: All environments (dev, staging, production) use the same GCP project
- **Supabase Projects**: 
  - **Dev/Test/Staging**: Share a single Supabase project (cost-effective for development)
  - **Production**: Separate Supabase project (isolated for production data)
- **Cloud Run Services**: Separate Cloud Run services per environment
- **CI/CD**: Automated builds and deployments via Cloud Build

## Environments

1. **Dev/Test** (`main` branch)
   - Service: `everredi-api-dev`
   - Supabase Project: Shared dev/staging project
   - Trigger: Push to `main` branch

2. **Staging** (`rc_*` tags)
   - Service: `everredi-api-staging`
   - Supabase Project: Shared dev/staging project (same as dev)
   - Trigger: Tag matching `rc_*` (e.g., `rc_1.0.0`)

3. **Production** (`prod_*` tags)
   - Service: `everredi-api-prod`
   - Supabase Project: Separate production project
   - Trigger: Tag matching `prod_*` (e.g., `prod_1.0.0`)

## Prerequisites

1. Google Cloud Project with billing enabled
2. Cloud Build API enabled
3. Cloud Run API enabled
4. Container Registry API enabled
5. Secret Manager API enabled
6. Supabase projects created for each environment
7. GitHub/GitLab repository connected to Cloud Build

## Initial Setup: Grant Cloud Build Permissions

Before creating triggers, you must grant the Cloud Build service account necessary permissions:

```bash
# Run the setup script
cd api
./setup-cloud-build-permissions.sh

# Or manually grant permissions:
PROJECT_ID="everredi-dev"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant required roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Also grant permissions to Compute Engine default service account
# (Cloud Build may use this in some configurations)
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

**Note**: The Cloud Build service account format is `{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`

### Troubleshooting: "Insufficient Permissions" Error

If you see an error like:

```
Failed to create trigger: insufficient permissions from service account
projects/everredi-dev/serviceAccounts/924111630132-compute@developer.gserviceaccount.com
```

This can happen for several reasons:

1. **Service accounts need permissions** - Run the setup script:

   ```bash
   cd api
   ./setup-cloud-build-permissions.sh
   ```

   This grants permissions to both the Cloud Build service account and Compute Engine service account.

2. **Your user account needs permissions** - Ensure your Google account has:
   - `roles/cloudbuild.builds.editor` - To create and manage triggers
   - `roles/iam.serviceAccountUser` - To use service accounts
   - `roles/storage.admin` - To access Container Registry

   Grant these to your user:

   ```bash
   YOUR_EMAIL="your-email@example.com"
   gcloud projects add-iam-policy-binding everredi-dev \
     --member="user:${YOUR_EMAIL}" \
     --role="roles/cloudbuild.builds.editor"
   ```

3. **GitHub repository not connected** - You must connect your GitHub repository first:
   - Go to Cloud Build → Triggers → "Connect Repository"
   - Select "GitHub (Cloud Build GitHub App)"
   - Authorize the app and select your repository
   - Then create triggers

4. **APIs not enabled** - Ensure these APIs are enabled:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   ```

## Setup Steps

### 1. Create Supabase Projects

Create Supabase projects for your environments:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create projects:
   - **Development/Staging**: `everredi-dev` (or similar) - Shared project for dev, test, and staging environments
   - **Production**: `everredi-prod` - Separate production project

**Note**: Dev, test, and staging share the same Supabase project to minimize costs during development. Production uses a separate project for data isolation and security.

3. For each project, get:
   - **Project URL**: Found in Project Settings → API (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Key**: Found in Project Settings → API → Service Role Key (format: `sb_secret_...` or legacy `service_role` key)

4. Run the database migrations:

   **Option 1: Using Supabase SQL Editor (Recommended)**
   
   1. Go to your Supabase project dashboard
   2. Navigate to SQL Editor
   3. Run the consolidated schema migration:
      - Copy contents of `api/migrations/000_consolidated_schema.sql`
      - Paste into SQL Editor
      - Execute
   4. (Optional but recommended) Run the supply catalog seed:
      - Copy contents of `api/migrations/001_seed_supply_catalog.sql`
      - Paste into SQL Editor
      - Execute
   
   **Option 2: Using psql**
   
   ```bash
   # Get connection string from Supabase Dashboard → Settings → Database
   # Run consolidated schema
   psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f api/migrations/000_consolidated_schema.sql
   
   # Run seed catalog (optional but recommended)
   psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f api/migrations/001_seed_supply_catalog.sql
   ```
   
   **Note**: The seed catalog (`001_seed_supply_catalog.sql`) is safe to run multiple times as it uses `ON CONFLICT DO NOTHING` to prevent duplicates.

5. Configure OAuth providers in Supabase Dashboard → Authentication → Providers (Google, Apple, etc.)

### 2. Store Secrets in Secret Manager

Create secrets for sensitive configuration:

```bash
# Dev and Staging share the same Supabase project, so they use the same Supabase secrets
# Production uses a separate Supabase project

# Dev environment (shared Supabase with staging)
echo -n "https://xxxxx-dev.supabase.co" | gcloud secrets create supabase-url-dev --data-file=-
echo -n "sb_secret_xxxxx..." | gcloud secrets create supabase-secret-key-dev --data-file=-
echo -n "sk_test_xxxxx" | gcloud secrets create stripe-secret-key-dev --data-file=-
echo -n "whsec_test_xxxxx" | gcloud secrets create stripe-webhook-secret-dev --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key-dev --data-file=-
# RevenueCat (optional but recommended for mobile subscriptions)
echo -n "your-revenuecat-secret-api-key" | gcloud secrets create revenuecat-secret-api-key-dev --data-file=-

# Staging environment (shares Supabase with dev - copy the same values)
echo -n "https://xxxxx-dev.supabase.co" | gcloud secrets create supabase-url-staging --data-file=-
echo -n "sb_secret_xxxxx..." | gcloud secrets create supabase-secret-key-staging --data-file=-
# Or copy from dev secrets:
# DEV_URL=$(gcloud secrets versions access latest --secret=supabase-url-dev)
# DEV_KEY=$(gcloud secrets versions access latest --secret=supabase-secret-key-dev)
# echo -n "$DEV_URL" | gcloud secrets create supabase-url-staging --data-file=-
# echo -n "$DEV_KEY" | gcloud secrets create supabase-secret-key-staging --data-file=-

echo -n "sk_test_xxxxx" | gcloud secrets create stripe-secret-key-staging --data-file=-
echo -n "whsec_test_xxxxx" | gcloud secrets create stripe-webhook-secret-staging --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key-staging --data-file=-
echo -n "your-revenuecat-secret-api-key" | gcloud secrets create revenuecat-secret-api-key-staging --data-file=-

# Production environment (separate Supabase project)
echo -n "https://xxxxx-prod.supabase.co" | gcloud secrets create supabase-url-prod --data-file=-
echo -n "sb_secret_xxxxx..." | gcloud secrets create supabase-secret-key-prod --data-file=-
echo -n "sk_live_xxxxx" | gcloud secrets create stripe-secret-key-prod --data-file=-
echo -n "whsec_live_xxxxx" | gcloud secrets create stripe-webhook-secret-prod --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key-prod --data-file=-
echo -n "your-revenuecat-secret-api-key" | gcloud secrets create revenuecat-secret-api-key-prod --data-file=-
```

Grant Cloud Run service account access to secrets:

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to all environment secrets
for env in dev staging prod; do
  for secret in supabase-url supabase-secret-key stripe-secret-key stripe-webhook-secret gemini-api-key revenuecat-secret-api-key; do
    gcloud secrets add-iam-policy-binding ${secret}-${env} \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/secretmanager.secretAccessor" || true
  done
done
```

### 3. Create Cloud Build Triggers

#### PR Trigger (Validation Only)

1. Go to Cloud Build → Triggers
2. Click "Create Trigger"
3. Configure:
   - **Name**: `pr-validation`
   - **Event**: Pull request
   - **Source**: Your repository
   - **Base branch**: `^main$`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.pr.yaml`
   - **Service account**: Use default Cloud Build service account (`{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`)
   - **Substitution variables**: None needed

#### Main Branch Trigger (Dev/Test)

1. Go to Cloud Build → Triggers
2. Click "Create Trigger"
3. Configure:
   - **Name**: `main-deploy-dev`
   - **Event**: Push to a branch
   - **Source**: Your repository
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.main.yaml`
   - **Service account**: Use default Cloud Build service account (`{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`)
   - **Substitution variables**:
     - `_ENV`: `dev`
     - `_CORS_ORIGIN`: `http://localhost:3000` (or your dev URL)

#### Staging Trigger

1. Go to Cloud Build → Triggers
2. Click "Create Trigger"
3. Configure:
   - **Name**: `staging-deploy`
   - **Event**: Push to a tag
   - **Source**: Your repository
   - **Tag**: `^rc_.*`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.staging.yaml`
   - **Service account**: Use default Cloud Build service account (`{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`)
   - **Substitution variables**:
     - `_ENV`: `staging`
     - `_CORS_ORIGIN`: `https://staging.everredi.app` (or your staging URL)

#### Production Trigger

1. Go to Cloud Build → Triggers
2. Click "Create Trigger"
3. Configure:
   - **Name**: `production-deploy`
   - **Event**: Push to a tag
   - **Source**: Your repository
   - **Tag**: `^prod_.*`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.prod.yaml`
   - **Service account**: Use default Cloud Build service account (`{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`)
   - **Substitution variables**:
     - `_ENV`: `prod`
     - `_CORS_ORIGIN`: `https://everredi.app`

### 4. Service Account Selection

**Important**: If your organization policy requires a user-managed service account, you must create one first.

#### Create User-Managed Service Account (Required for Organization Policies)

If you see: _"Your organization policy requires you to select a user-managed service account"_

Run this script to create a custom service account:

```bash
cd api
./create-cloud-build-sa.sh
```

This creates: `cloud-build-runner@everredi-dev.iam.gserviceaccount.com`

**When creating triggers, select this service account** from the dropdown.

#### Option 1: Use Default (If Policy Allows)

**Leave the service account field empty/use default**. Cloud Build will automatically use the Cloud Build service account (`{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`) when no service account is specified. This is the simplest approach, but may not be allowed by organization policies.

#### Option 2: Create and Use Cloud Build Service Account Explicitly

If you want to explicitly select a service account, first ensure the Cloud Build service account exists:

```bash
# The Cloud Build service account is automatically created when you enable Cloud Build API
# Verify it exists:
gcloud projects get-iam-policy everredi-dev \
  --flatten="bindings[].members" \
  --filter="bindings.members:*@cloudbuild.gserviceaccount.com"

# If it doesn't exist, enable Cloud Build API (this creates it):
gcloud services enable cloudbuild.googleapis.com
```

Then in the trigger creation UI:

- **Service Account**: Select "Cloud Build default service account" or leave empty
- The service account format is: `{PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`
- For your project: `924111630132@cloudbuild.gserviceaccount.com`

#### Option 3: Use Compute Engine Default Service Account

If the Cloud Build service account doesn't appear, you can temporarily use:

- **Service Account**: `924111630132-compute@developer.gserviceaccount.com` (Compute Engine default)

**Note**: We've granted this service account the necessary permissions in the setup script, so it will work. However, using the Cloud Build service account (Option 1 or 2) is preferred.

#### Troubleshooting

If no service accounts appear in the dropdown:

1. Ensure Cloud Build API is enabled: `gcloud services enable cloudbuild.googleapis.com`
2. Wait a few minutes for the service account to be created
3. Refresh the trigger creation page
4. Try leaving the service account field empty (uses default)

### 5. Configure Substitution Variables in Triggers

Each trigger needs environment-specific substitution variables. You can set them when creating the trigger in the GCP Console, or update them via CLI:

```bash
# Dev/Test trigger
gcloud builds triggers update main-deploy-dev \
  --substitutions=_ENV=dev,_CORS_ORIGIN="http://localhost:3000"

# Staging trigger
gcloud builds triggers update staging-deploy \
  --substitutions=_ENV=staging,_CORS_ORIGIN="https://staging.everredi.app"

# Production trigger
gcloud builds triggers update production-deploy \
  --substitutions=_ENV=prod,_CORS_ORIGIN="https://everredi.app"
```

**Note**: The cloudbuild files have default values, but you should override them in the trigger configuration for production use.

## Deployment Workflow

### Development/Test

1. Create a feature branch
2. Make changes and commit
3. Open a Pull Request to `main`
4. Cloud Build automatically runs validation (lint, test, build)
5. Merge PR to `main`
6. Cloud Build automatically deploys to `everredi-api-dev`

### Staging

1. Create a release candidate tag: `git tag rc_1.0.0`
2. Push the tag: `git push origin rc_1.0.0`
3. Cloud Build automatically deploys to `everredi-api-staging`

### Production

1. After testing in staging, create a production tag: `git tag prod_1.0.0`
2. Push the tag: `git push origin prod_1.0.0`
3. Cloud Build automatically deploys to `everredi-api-prod`

## Manual Deployment

If you need to deploy manually:

```bash
# Build and deploy to dev
gcloud builds submit --config=cloudbuild.main.yaml

# Build and deploy to staging
gcloud builds submit --config=cloudbuild.staging.yaml --substitutions=TAG_NAME=rc_1.0.0

# Build and deploy to production
gcloud builds submit --config=cloudbuild.prod.yaml --substitutions=TAG_NAME=prod_1.0.0
```

## Environment Variables Reference

### Required Environment Variables

- `SUPABASE_URL`: Your Supabase project URL (set via Secret Manager)
- `SUPABASE_SECRET_KEY`: Supabase service role key (set via Secret Manager)
- `PORT`: Server port (default: 8080, set automatically by Cloud Run)
- `NODE_ENV`: Node environment (`production`)

### Required Secrets (via Secret Manager)

Secrets should be created with environment suffixes for isolation:

- `supabase-url-{env}`: Supabase project URL
  - **Dev/Staging**: Share the same Supabase project (use same values)
  - **Production**: Separate Supabase project
- `supabase-secret-key-{env}`: Supabase service role key
  - **Dev/Staging**: Share the same key (same Supabase project)
  - **Production**: Separate key (separate Supabase project)
- `stripe-secret-key-{env}`: Stripe API secret key (dev, staging, prod)
- `stripe-webhook-secret-{env}`: Stripe webhook secret (dev, staging, prod)
- `gemini-api-key-{env}`: Google Gemini API key (dev, staging, prod)
- `revenuecat-secret-api-key-{env}`: RevenueCat Secret API Key (optional but recommended for mobile subscriptions)

Example: `supabase-url-dev`, `supabase-url-staging`, `supabase-url-prod`

**Important**: Dev and staging share the same Supabase project to minimize costs. They should use the same Supabase URL and secret key values. Production uses a completely separate Supabase project for data isolation.

**Note**: RevenueCat secrets are optional but required if you're using mobile app subscriptions. The API will function without them, but RevenueCat integration features will be disabled.

### Optional Environment Variables

- `CORS_ORIGIN`: Allowed CORS origin (default: `http://localhost:3000`)
- `GEMINI_MODEL`: Gemini model to use (default: `gemini-1.0-pro`)
- `REVENUECAT_WEBHOOK_SECRET`: RevenueCat webhook verification secret (optional, for webhook security)

### Sentry Configuration (Optional)

Sentry is configured via Cloud Build substitution variables, not Secret Manager. These are set automatically in staging and production builds:

- `SENTRY_DSN`: Sentry project DSN for error tracking (set via Cloud Build substitution `_SENTRY_DSN`)
- `SENTRY_ENVIRONMENT`: Environment name for Sentry (auto-set: `dev`, `staging`, or `production`)
- `SENTRY_RELEASE`: Release version for Sentry (auto-set from git commit SHA `$SHORT_SHA`)
- `SENTRY_TRACES_SAMPLE_RATE`: Trace sampling rate (default: `0.1` for staging, `1.0` for production)

To enable Sentry, set the `_SENTRY_DSN` substitution variable in your Cloud Build trigger configuration. If not set, Sentry will be disabled and the application will continue to function normally.

## Health Check

The service exposes a health check endpoint at `/api/health`:

```bash
curl https://everredi-api-dev-xxxxx.run.app/api/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2025-12-12T12:00:00.000Z",
  "service": "everredi-api",
  "environment": "production"
}
```

## Troubleshooting

### Build Failures

- Check Cloud Build logs in GCP Console
- Verify all secrets exist in Secret Manager
- Ensure Cloud Build service account has necessary permissions

### Deployment Failures

- Check Cloud Run service logs
- Verify environment variables are set correctly
- Ensure Supabase projects exist and are accessible
- Check that secrets are accessible by Cloud Run service account

### Runtime Errors

- Check Cloud Run logs: `gcloud run services logs read everredi-api-dev --region=us-central1`
- Verify Supabase initialization in logs
- Check that Supabase URL and secret key are correct
- Verify database migration has been run

### Supabase Connection Issues

- Verify `SUPABASE_URL` matches your Supabase project URL
- Check that `SUPABASE_SECRET_KEY` is the service role key (not the anon key)
- Ensure the database migration has been run
- Check Supabase project status in the dashboard

## Cost Optimization

- **Min Instances**: Set to 0 to scale to zero when not in use
- **Max Instances**: Adjust based on traffic (default: 10)
- **CPU/Memory**: Start with 1 CPU, 512Mi (adjust based on performance)
- **Timeout**: Set to 300s (5 minutes) for long-running requests

## Security Notes

- All secrets are stored in Secret Manager, not in code
- Cloud Run services are publicly accessible (use Cloud Armor for additional protection)
- CORS is configured per environment
- Supabase projects are isolated per environment
- Service role keys have admin privileges - keep them secret
