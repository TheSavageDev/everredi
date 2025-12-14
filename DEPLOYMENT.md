# Cloud Run Deployment Guide

This document describes how to deploy the Everredi backend to Google Cloud Run using Cloud Build CI/CD.

## Architecture

- **Single GCP Project**: All environments (dev, staging, production) use the same GCP project
- **Multiple Firestore Databases**: Each environment uses a separate Firestore database
- **Cloud Run Services**: Separate Cloud Run services per environment
- **CI/CD**: Automated builds and deployments via Cloud Build

## Environments

1. **Dev/Test** (`main` branch)
   - Service: `everredi-api-dev`
   - Firestore Database: `(default)` or `dev`
   - Trigger: Push to `main` branch

2. **Staging** (`rc_*` tags)
   - Service: `everredi-api-staging`
   - Firestore Database: `staging`
   - Trigger: Tag matching `rc_*` (e.g., `rc_1.0.0`)

3. **Production** (`prod_*` tags)
   - Service: `everredi-api-prod`
   - Firestore Database: `prod`
   - Trigger: Tag matching `prod_*` (e.g., `prod_1.0.0`)

## Prerequisites

1. Google Cloud Project with billing enabled
2. Cloud Build API enabled
3. Cloud Run API enabled
4. Container Registry API enabled
5. Secret Manager API enabled
6. Firestore API enabled
7. GitHub/GitLab repository connected to Cloud Build

## Initial Setup: Grant Cloud Build Permissions

Before creating triggers, you must grant the Cloud Build service account necessary permissions:

```bash
# Run the setup script
cd backend
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
   cd backend
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

### 1. Create Firestore Databases

For each environment, create a Firestore database in your GCP project:

```bash
# Dev/Test (uses default database, or create named 'dev')
gcloud firestore databases create --database=dev --location=us-central1

# Staging
gcloud firestore databases create --database=staging --location=us-central1

# Production
gcloud firestore databases create --database=prod --location=us-central1
```

### 2. Store Secrets in Secret Manager

Create secrets for sensitive configuration:

```bash
# For each environment (dev, staging, prod), create secrets:

# Dev environment
echo -n "YOUR_DEV_PRIVATE_KEY" | gcloud secrets create firebase-private-key-dev --data-file=-
echo -n "firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com" | gcloud secrets create firebase-client-email-dev --data-file=-
echo -n "sk_test_xxxxx" | gcloud secrets create stripe-secret-key-dev --data-file=-
echo -n "whsec_test_xxxxx" | gcloud secrets create stripe-webhook-secret-dev --data-file=-
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key-dev --data-file=-

# Staging environment (repeat with staging values)
echo -n "YOUR_STAGING_PRIVATE_KEY" | gcloud secrets create firebase-private-key-staging --data-file=-
# ... repeat for other secrets with -staging suffix

# Production environment (repeat with prod values)
echo -n "YOUR_PROD_PRIVATE_KEY" | gcloud secrets create firebase-private-key-prod --data-file=-
# ... repeat for other secrets with -prod suffix
```

Grant Cloud Run service account access to secrets:

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to all environment secrets
for env in dev staging prod; do
  for secret in firebase-private-key firebase-client-email stripe-secret-key stripe-webhook-secret gemini-api-key; do
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
     - `_DATABASE_ID`: `(default)`
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
     - `_DATABASE_ID`: `staging`
     - `_CORS_ORIGIN`: `https://staging.everredi.com` (or your staging URL)

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
     - `_DATABASE_ID`: `prod`
     - `_CORS_ORIGIN`: `https://everredi.com`

### 4. Service Account Selection

**Important**: If your organization policy requires a user-managed service account, you must create one first.

#### Create User-Managed Service Account (Required for Organization Policies)

If you see: _"Your organization policy requires you to select a user-managed service account"_

Run this script to create a custom service account:

```bash
cd backend
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
  --substitutions=_ENV=dev,_DATABASE_ID="(default)",_CORS_ORIGIN="http://localhost:3000"

# Staging trigger
gcloud builds triggers update staging-deploy \
  --substitutions=_ENV=staging,_DATABASE_ID=staging,_CORS_ORIGIN="https://staging.everredi.com"

# Production trigger
gcloud builds triggers update production-deploy \
  --substitutions=_ENV=prod,_DATABASE_ID=prod,_CORS_ORIGIN="https://everredi.com"
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

- `FIREBASE_PROJECT_ID`: Your GCP project ID (set automatically in Cloud Build)
- `FIREBASE_DATABASE_ID`: Firestore database name (`(default)`, `dev`, `staging`, `prod`)
- `PORT`: Server port (default: 8080, set automatically by Cloud Run)
- `NODE_ENV`: Node environment (`production`)

### Required Secrets (via Secret Manager)

Secrets should be created with environment suffixes for isolation:

- `firebase-private-key-{env}`: Firebase service account private key (dev, staging, prod)
- `firebase-client-email-{env}`: Firebase service account email (dev, staging, prod)
- `stripe-secret-key-{env}`: Stripe API secret key (dev, staging, prod)
- `stripe-webhook-secret-{env}`: Stripe webhook secret (dev, staging, prod)
- `gemini-api-key-{env}`: Google Gemini API key (dev, staging, prod)

Example: `firebase-private-key-dev`, `firebase-private-key-staging`, `firebase-private-key-prod`

### Optional Environment Variables

- `CORS_ORIGIN`: Allowed CORS origin (default: `http://localhost:3000`)
- `GEMINI_MODEL`: Gemini model to use (default: `gemini-1.0-pro`)

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
- Ensure Firestore databases exist
- Check that secrets are accessible by Cloud Run service account

### Runtime Errors

- Check Cloud Run logs: `gcloud run services logs read everredi-api-dev --region=us-central1`
- Verify Firebase initialization in logs
- Check that Firestore database ID matches environment

## Cost Optimization

- **Min Instances**: Set to 0 to scale to zero when not in use
- **Max Instances**: Adjust based on traffic (default: 10)
- **CPU/Memory**: Start with 1 CPU, 512Mi (adjust based on performance)
- **Timeout**: Set to 300s (5 minutes) for long-running requests

## Security Notes

- All secrets are stored in Secret Manager, not in code
- Cloud Run services are publicly accessible (use Cloud Armor for additional protection)
- CORS is configured per environment
- Firestore databases are isolated per environment
