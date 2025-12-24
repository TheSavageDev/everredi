#!/bin/bash

# Script to create staging secrets in Secret Manager for API deployment
# This sets up all required secrets for the staging environment

set -e

PROJECT_ID="${PROJECT_ID:-everredi-dev}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
ENV="staging"

echo "Setting up staging secrets in Secret Manager"
echo "Project: ${PROJECT_ID}"
echo "Environment: ${ENV}"
echo ""

# Check if Secret Manager API is enabled
if ! gcloud services list --enabled --filter="name:secretmanager.googleapis.com" --format="value(name)" | grep -q secretmanager; then
  echo "Enabling Secret Manager API..."
  gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
fi

# Function to create or update a secret
create_secret() {
  local secret_name=$1
  local description=$2
  local prompt_text=$3
  local is_sensitive=${4:-true}
  
  if gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
    echo "⚠️  Secret $secret_name already exists."
    read -p "  Update it? (y/n) [default: n]: " UPDATE
    if [ "$UPDATE" != "y" ] && [ "$UPDATE" != "Y" ]; then
      echo "  Skipping $secret_name"
      return 0
    fi
  else
    echo "Creating secret: $secret_name"
    # Create empty secret first
    echo -n "" | gcloud secrets create $secret_name \
      --project=$PROJECT_ID \
      --data-file=- \
      --replication-policy="automatic" \
      --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || true
  fi
  
  # Get the value
  if [ -z "$prompt_text" ]; then
    prompt_text="Enter value for $secret_name"
  fi
  
  if [ "$is_sensitive" = "true" ]; then
    echo -n "$prompt_text: "
    read -s SECRET_VALUE
    echo ""
  else
    read -p "$prompt_text: " SECRET_VALUE
  fi
  
  if [ -n "$SECRET_VALUE" ]; then
    echo -n "$SECRET_VALUE" | gcloud secrets versions add $secret_name \
      --project=$PROJECT_ID \
      --data-file=-
    echo "  ✅ Secret $secret_name updated"
  else
    echo "  ⚠️  Empty value, skipping"
  fi
}

# Required secrets for staging
echo "=== Required Secrets ==="
echo ""

# Firebase credentials
echo "Firebase Configuration:"
echo "You can get these from your Firebase service account JSON key file"
echo ""

# Try to read from existing dev secrets as reference
if gcloud secrets describe firebase-private-key-dev --project=$PROJECT_ID &>/dev/null 2>&1; then
  echo "Found dev secrets. You can use the same values for staging, or enter new ones."
  read -p "Use same Firebase credentials as dev? (y/n) [default: n]: " USE_DEV
  if [ "$USE_DEV" = "y" ] || [ "$USE_DEV" = "Y" ]; then
    echo "Copying from dev secrets..."
    DEV_PRIVATE_KEY=$(gcloud secrets versions access latest --secret=firebase-private-key-dev --project=$PROJECT_ID)
    DEV_CLIENT_EMAIL=$(gcloud secrets versions access latest --secret=firebase-client-email-dev --project=$PROJECT_ID)
    
    # Create staging secrets with dev values
    echo -n "$DEV_PRIVATE_KEY" | gcloud secrets create firebase-private-key-${ENV} \
      --project=$PROJECT_ID \
      --data-file=- \
      --replication-policy="automatic" \
      --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || \
    echo -n "$DEV_PRIVATE_KEY" | gcloud secrets versions add firebase-private-key-${ENV} \
      --project=$PROJECT_ID \
      --data-file=-
    
    echo -n "$DEV_CLIENT_EMAIL" | gcloud secrets create firebase-client-email-${ENV} \
      --project=$PROJECT_ID \
      --data-file=- \
      --replication-policy="automatic" \
      --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || \
    echo -n "$DEV_CLIENT_EMAIL" | gcloud secrets versions add firebase-client-email-${ENV} \
      --project=$PROJECT_ID \
      --data-file=-
    
    echo "  ✅ Copied Firebase credentials from dev"
  else
    create_secret "firebase-private-key-${ENV}" "Firebase Private Key" "Firebase service account private key (from JSON key file)" "true"
    create_secret "firebase-client-email-${ENV}" "Firebase Client Email" "Firebase service account email (e.g., firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com)" "false"
  fi
else
  create_secret "firebase-private-key-${ENV}" "Firebase Private Key" "Firebase service account private key (from JSON key file)" "true"
  create_secret "firebase-client-email-${ENV}" "Firebase Client Email" "Firebase service account email (e.g., firebase-adminsdk-xxxxx@project-id.iam.gserviceaccount.com)" "false"
fi

echo ""

# Gemini API Key
echo "Gemini AI Configuration:"
create_secret "gemini-api-key-${ENV}" "Gemini API Key" "Google Gemini API key" "true"

echo ""

# Stripe (optional but recommended)
echo "Stripe Configuration (optional - press Enter to skip):"
read -p "Set up Stripe secrets? (y/n) [default: n]: " SETUP_STRIPE
if [ "$SETUP_STRIPE" = "y" ] || [ "$SETUP_STRIPE" = "Y" ]; then
  create_secret "stripe-secret-key-${ENV}" "Stripe Secret Key" "Stripe API secret key (e.g., sk_test_xxxxx)" "true"
  create_secret "stripe-webhook-secret-${ENV}" "Stripe Webhook Secret" "Stripe webhook signing secret (e.g., whsec_test_xxxxx)" "true"
else
  echo "Skipping Stripe secrets (you can add them later)"
  # Create empty secrets so deployment doesn't fail
  echo -n "" | gcloud secrets create stripe-secret-key-${ENV} \
    --project=$PROJECT_ID \
    --data-file=- \
    --replication-policy="automatic" \
    --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || true
  
  echo -n "" | gcloud secrets create stripe-webhook-secret-${ENV} \
    --project=$PROJECT_ID \
    --data-file=- \
    --replication-policy="automatic" \
    --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || true
fi

echo ""

# RevenueCat (optional but recommended for mobile subscriptions)
echo "RevenueCat Configuration (optional - press Enter to skip):"
read -p "Set up RevenueCat secrets? (y/n) [default: n]: " SETUP_REVENUECAT
if [ "$SETUP_REVENUECAT" = "y" ] || [ "$SETUP_REVENUECAT" = "Y" ]; then
  create_secret "revenuecat-secret-api-key-${ENV}" "RevenueCat Secret API Key" "RevenueCat secret API key (from RevenueCat dashboard → API Keys)" "true"
else
  echo "Skipping RevenueCat secrets (you can add them later)"
  # Create empty secret so deployment doesn't fail
  echo -n "" | gcloud secrets create revenuecat-secret-api-key-${ENV} \
    --project=$PROJECT_ID \
    --data-file=- \
    --replication-policy="automatic" \
    --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || true
fi

echo ""
echo "=== Granting Access ==="
echo "Granting Cloud Run service account access to secrets..."
echo "Service Account: ${SERVICE_ACCOUNT}"
echo ""

# Grant access to all staging secrets
for secret in firebase-private-key firebase-client-email gemini-api-key stripe-secret-key stripe-webhook-secret revenuecat-secret-api-key; do
  secret_name="${secret}-${ENV}"
  if gcloud secrets describe $secret_name --project=$PROJECT_ID &>/dev/null; then
    echo "Granting access to: $secret_name"
    gcloud secrets add-iam-policy-binding $secret_name \
      --project=$PROJECT_ID \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/secretmanager.secretAccessor" || echo "  (May already have access)"
  fi
done

echo ""
echo "✅ Staging secrets setup complete!"
echo ""
echo "Secrets created:"
echo "  - firebase-private-key-${ENV}"
echo "  - firebase-client-email-${ENV}"
echo "  - gemini-api-key-${ENV}"
echo "  - stripe-secret-key-${ENV} (if configured)"
echo "  - stripe-webhook-secret-${ENV} (if configured)"
echo "  - revenuecat-secret-api-key-${ENV} (if configured)"
echo ""
echo "To update a secret later, use:"
echo "  echo -n 'NEW_VALUE' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""
echo "Example:"
echo "  echo -n 'sk_test_newkey' | gcloud secrets versions add stripe-secret-key-${ENV} --data-file=-"
echo ""
echo "Next steps:"
echo "  1. Verify secrets exist: gcloud secrets list --filter='labels.environment:${ENV}'"
echo "  2. Test deployment: git tag rc_1.0.0 && git push origin rc_1.0.0"

