#!/bin/bash

# Script to grant Cloud Build permissions to your user account
# This fixes "insufficient permissions" errors when creating triggers via UI

set -e

PROJECT_ID="everredi-dev"

# Get your email from gcloud config
YOUR_EMAIL=$(gcloud config get-value account)

if [ -z "$YOUR_EMAIL" ]; then
  echo "Error: No account found in gcloud config."
  echo "Please run: gcloud auth login"
  exit 1
fi

echo "Granting Cloud Build permissions to: ${YOUR_EMAIL}"
echo "Project: ${PROJECT_ID}"
echo ""

# Cloud Build Editor - Create and manage triggers
echo "Granting Cloud Build Editor role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

# Service Account User - Use service accounts
echo "Granting Service Account User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Storage Admin - Access Container Registry
echo "Granting Storage Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/storage.admin"

# Secret Manager Admin - Manage secrets (optional, for secret creation)
echo "Granting Secret Manager Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/secretmanager.admin"

# Cloud Run Admin - Deploy services (optional, for manual deployments)
echo "Granting Cloud Run Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${YOUR_EMAIL}" \
  --role="roles/run.admin"

echo ""
echo "✅ Permissions granted successfully!"
echo ""
echo "Your account (${YOUR_EMAIL}) now has permissions to:"
echo "  - Create and manage Cloud Build triggers"
echo "  - Use service accounts"
echo "  - Access Container Registry"
echo "  - Manage secrets"
echo "  - Deploy to Cloud Run"
echo ""
echo "You should now be able to create Cloud Build triggers."
