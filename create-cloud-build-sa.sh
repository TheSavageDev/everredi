#!/bin/bash

# Script to create a user-managed service account for Cloud Build
# Required when organization policy requires user-managed service accounts

set -e

PROJECT_ID="everredi-dev"
SA_NAME="cloud-build-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SA_DISPLAY_NAME="Cloud Build Runner Service Account"

echo "Creating user-managed service account for Cloud Build..."
echo "Project: ${PROJECT_ID}"
echo "Service Account: ${SA_EMAIL}"
echo ""

# Check if service account already exists
if gcloud iam service-accounts describe ${SA_EMAIL} &>/dev/null; then
  echo "⚠️  Service account already exists: ${SA_EMAIL}"
  echo "   Skipping creation, but will update permissions..."
else
  # Create the service account
  echo "Creating service account..."
  gcloud iam service-accounts create ${SA_NAME} \
    --display-name="${SA_DISPLAY_NAME}" \
    --description="User-managed service account for Cloud Build CI/CD pipelines" \
    --project=${PROJECT_ID}

  echo "✅ Service account created: ${SA_EMAIL}"
fi

echo ""
echo "Granting necessary permissions..."

# 1. Cloud Run Admin - Deploy and manage Cloud Run services
echo "Granting Cloud Run Admin role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

# 2. Service Account User - Impersonate service accounts (needed for Cloud Run)
echo "Granting Service Account User role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# 3. Storage Admin - Push images to Container Registry / Artifact Registry
echo "Granting Storage Admin role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin"

# 4. Secret Manager Secret Accessor - Access secrets
echo "Granting Secret Manager Secret Accessor role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# 5. Cloud Build Service Account - Execute builds
echo "Granting Cloud Build Service Account role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.builder"

# 6. Artifact Registry Writer (if using Artifact Registry)
echo "Granting Artifact Registry Writer role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" || echo "  (Skipped - may not be using Artifact Registry)"

# 7. Allow the service account to act as itself (sometimes needed)
echo "Granting service account token creator role..."
gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator" || echo "  (May already have this role)"

# 8. Grant Cloud Build Editor role (needed for creating/managing builds)
echo "Granting Cloud Build Editor role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

# 9. Grant Logs Writer (needed for Cloud Build to write logs)
echo "Granting Logs Writer role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/logging.logWriter"

# 10. Grant Source Repository Reader (if using Cloud Source Repositories)
echo "Granting Source Repository Reader role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/source.reader" || echo "  (Skipped - may not be using Cloud Source Repositories)"

# 11. Important: Grant the service account permission to use itself
# This is required for Cloud Build to execute builds
echo "Granting service account user role to itself..."
gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" || echo "  (May already have this role)"

# 12. Grant Service Usage Consumer (needed to use GCP services)
echo "Granting Service Usage Consumer role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/serviceusage.serviceUsageConsumer"

echo ""
echo "✅ Service account created and configured successfully!"
echo ""
echo "Service Account Details:"
echo "  Email: ${SA_EMAIL}"
echo "  Name: ${SA_NAME}"
echo "  Display Name: ${SA_DISPLAY_NAME}"
echo ""
echo "When creating Cloud Build triggers, select:"
echo "  Service Account: ${SA_EMAIL}"
echo ""
echo "This service account has the following permissions:"
echo "  - Cloud Run Admin (deploy services)"
echo "  - Service Account User (use service accounts)"
echo "  - Storage Admin (push images)"
echo "  - Secret Manager Secret Accessor (read secrets)"
echo "  - Cloud Build Service Account (execute builds)"
echo "  - Cloud Build Editor (create/manage builds)"
echo "  - Logs Writer (write build logs)"
echo "  - Artifact Registry Writer (push to Artifact Registry)"
echo "  - Service Usage Consumer (use GCP services)"
echo ""
echo "If you still get permission errors, run this script again to ensure all permissions are granted."
