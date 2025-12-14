#!/bin/bash

# Script to verify and create Cloud Build service account if needed

set -e

PROJECT_ID="everredi-dev"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "Checking Cloud Build service account for project: ${PROJECT_ID}"
echo "Expected service account: ${CLOUD_BUILD_SA}"
echo ""

# Check if Cloud Build API is enabled
echo "Checking if Cloud Build API is enabled..."
if gcloud services list --enabled --filter="name:cloudbuild.googleapis.com" --format="value(name)" | grep -q cloudbuild; then
  echo "✅ Cloud Build API is enabled"
else
  echo "⚠️  Cloud Build API is not enabled. Enabling now..."
  gcloud services enable cloudbuild.googleapis.com
  echo "✅ Cloud Build API enabled. Service account should be created automatically."
  echo "   Please wait a few minutes and refresh the trigger creation page."
fi

echo ""
echo "Checking if service account exists..."
if gcloud iam service-accounts describe ${CLOUD_BUILD_SA} &>/dev/null; then
  echo "✅ Service account exists: ${CLOUD_BUILD_SA}"
else
  echo "⚠️  Service account not found. This is unusual - it should be created automatically."
  echo "   Try:"
  echo "   1. Wait a few minutes after enabling the API"
  echo "   2. Refresh the Cloud Build triggers page"
  echo "   3. Or leave the service account field empty when creating triggers (uses default)"
fi

echo ""
echo "Available service accounts in project:"
gcloud iam service-accounts list --format="table(email,displayName)" --filter="email~cloudbuild OR email~compute"

echo ""
echo "When creating triggers:"
echo "  - Option 1: Leave service account field EMPTY (recommended)"
echo "  - Option 2: Select Compute Engine default: ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "  - Option 3: Wait for Cloud Build SA to appear: ${CLOUD_BUILD_SA}"
