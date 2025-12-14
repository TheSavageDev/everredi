#!/bin/bash

# Script to grant necessary permissions to Cloud Build service account
# Run this script to fix "insufficient permissions" errors when creating triggers

set -e

PROJECT_ID="everredi-dev"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Cloud Build service account
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Compute Engine default service account (sometimes used by Cloud Build)
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Granting permissions to service accounts"
echo "Project: ${PROJECT_ID} (${PROJECT_NUMBER})"
echo "Cloud Build SA: ${CLOUD_BUILD_SA}"
echo "Compute Engine SA: ${COMPUTE_SA}"
echo ""

# 1. Cloud Run Admin - Deploy and manage Cloud Run services
echo "Granting Cloud Run Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

# 2. Service Account User - Impersonate service accounts (needed for Cloud Run)
echo "Granting Service Account User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"

# 3. Storage Admin - Push images to Container Registry / Artifact Registry
echo "Granting Storage Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/storage.admin"

# 4. Secret Manager Secret Accessor - Access secrets (if using Secret Manager)
echo "Granting Secret Manager Secret Accessor role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

# 5. Cloud Build Service Account - Already has this, but ensure it's set
echo "Ensuring Cloud Build Service Account role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/cloudbuild.builds.builder"

# 5b. Cloud Build Editor - Full control over builds and triggers
echo "Granting Cloud Build Editor role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/cloudbuild.builds.editor"

# 6. Source Repository Reader (if using Cloud Source Repositories)
# Or GitHub App permissions (if using GitHub)
echo ""
echo "Note: If using GitHub, ensure the GitHub App has been connected and authorized."
echo "If using Cloud Source Repositories, granting Source Repository Reader role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/source.reader" || echo "  (Skipped - may not be using Cloud Source Repositories)"

# 7. Artifact Registry Writer (if using Artifact Registry instead of Container Registry)
echo "Granting Artifact Registry Writer role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" || echo "  (Skipped - may not be using Artifact Registry)"

echo ""
echo "Granting permissions to Compute Engine service account (if needed)..."
echo "Note: Cloud Build may use this service account in some configurations"

# Grant same permissions to Compute Engine SA
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/run.admin" || echo "  (May already have this role)"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/iam.serviceAccountUser" || echo "  (May already have this role)"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.admin" || echo "  (May already have this role)"

echo ""
echo "Granting permissions to Compute Engine default service account..."
echo "Note: Cloud Build may use this service account in some scenarios"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/run.admin" || echo "  (May already have this role)"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/iam.serviceAccountUser" || echo "  (May already have this role)"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.admin" || echo "  (May already have this role)"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" || echo "  (May already have this role)"

# Also ensure the service account can act as itself (sometimes needed)
gcloud iam service-accounts add-iam-policy-binding ${COMPUTE_SA} \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/iam.serviceAccountTokenCreator" || echo "  (May already have this role)"

echo ""
echo "✅ Permissions granted successfully!"
echo ""
echo "Both service accounts now have permissions:"
echo "  - Cloud Build SA: ${CLOUD_BUILD_SA}"
echo "  - Compute Engine SA: ${COMPUTE_SA}"
echo ""
echo "Permissions include:"
echo "  - Deploy to Cloud Run"
echo "  - Push images to Container Registry/Artifact Registry"
echo "  - Access Secret Manager secrets"
echo "  - Use service accounts"
echo ""
echo "You can now create Cloud Build triggers."
