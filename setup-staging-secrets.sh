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

# Supabase Configuration (Required)
echo "Supabase Configuration (Required):"
echo "Get these from your Supabase project dashboard → Project Settings → API"
echo ""

# Try to read from existing dev secrets as reference
# Note: Dev and staging share the same Supabase project, so they should use the same credentials
if gcloud secrets describe supabase-url-dev --project=$PROJECT_ID &>/dev/null 2>&1; then
  echo "Found dev secrets. Staging should use the same Supabase project as dev."
  read -p "Copy Supabase credentials from dev? (y/n) [default: y]: " USE_DEV
  if [ "$USE_DEV" != "n" ] && [ "$USE_DEV" != "N" ]; then
    echo "Copying from dev secrets (dev and staging share the same Supabase project)..."
    DEV_SUPABASE_URL=$(gcloud secrets versions access latest --secret=supabase-url-dev --project=$PROJECT_ID)
    DEV_SUPABASE_KEY=$(gcloud secrets versions access latest --secret=supabase-secret-key-dev --project=$PROJECT_ID)
    
    # Create staging secrets with dev values
    echo -n "$DEV_SUPABASE_URL" | gcloud secrets create supabase-url-${ENV} \
      --project=$PROJECT_ID \
      --data-file=- \
      --replication-policy="automatic" \
      --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || \
    echo -n "$DEV_SUPABASE_URL" | gcloud secrets versions add supabase-url-${ENV} \
      --project=$PROJECT_ID \
      --data-file=-
    
    echo -n "$DEV_SUPABASE_KEY" | gcloud secrets create supabase-secret-key-${ENV} \
      --project=$PROJECT_ID \
      --data-file=- \
      --replication-policy="automatic" \
      --labels="app=everredi-api,environment=${ENV}" 2>/dev/null || \
    echo -n "$DEV_SUPABASE_KEY" | gcloud secrets versions add supabase-secret-key-${ENV} \
      --project=$PROJECT_ID \
      --data-file=-
    
    echo "  ✅ Copied Supabase credentials from dev (shared Supabase project)"
  else
    create_secret "supabase-url-${ENV}" "Supabase Project URL" "Supabase project URL (should match dev: https://xxxxx.supabase.co)" "false"
    create_secret "supabase-secret-key-${ENV}" "Supabase Service Role Key" "Supabase service role key (should match dev)" "true"
  fi
else
  echo "Note: Dev and staging share the same Supabase project. Use the same URL and key for both."
  create_secret "supabase-url-${ENV}" "Supabase Project URL" "Supabase project URL (e.g., https://xxxxx.supabase.co) - use same as dev" "false"
  create_secret "supabase-secret-key-${ENV}" "Supabase Service Role Key" "Supabase service role key (format: sb_secret_... or legacy service_role key) - use same as dev" "true"
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
echo "RevenueCat Configuration:"
echo "Required if you're using mobile app subscriptions. Optional for web-only deployments."
read -p "Set up RevenueCat secrets? (y/n) [default: n]: " SETUP_REVENUECAT
if [ "$SETUP_REVENUECAT" = "y" ] || [ "$SETUP_REVENUECAT" = "Y" ]; then
  create_secret "revenuecat-secret-api-key-${ENV}" "RevenueCat Secret API Key" "RevenueCat secret API key (from RevenueCat dashboard → API Keys → Secret API Key)" "true"
  echo ""
  read -p "Set up RevenueCat webhook secret? (y/n) [default: n]: " SETUP_REVENUECAT_WEBHOOK
  if [ "$SETUP_REVENUECAT_WEBHOOK" = "y" ] || [ "$SETUP_REVENUECAT_WEBHOOK" = "Y" ]; then
    create_secret "revenuecat-webhook-secret-${ENV}" "RevenueCat Webhook Secret" "RevenueCat webhook verification secret (generate with: openssl rand -hex 32)" "true"
  fi
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
for secret in supabase-url supabase-secret-key gemini-api-key stripe-secret-key stripe-webhook-secret revenuecat-secret-api-key revenuecat-webhook-secret; do
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
echo "  - supabase-url-${ENV} (required)"
echo "  - supabase-secret-key-${ENV} (required)"
echo "  - gemini-api-key-${ENV} (required)"
echo "  - stripe-secret-key-${ENV} (if configured)"
echo "  - stripe-webhook-secret-${ENV} (if configured)"
echo "  - revenuecat-secret-api-key-${ENV} (if configured)"
echo "  - revenuecat-webhook-secret-${ENV} (if configured)"
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

