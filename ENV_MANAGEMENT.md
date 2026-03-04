# Environment Configuration Management in GCP

This document describes different approaches for managing environment-specific configurations across dev, staging, and production environments in Google Cloud Platform.

## Approach 1: Cloud Build Substitution Variables (Recommended)

Use Cloud Build substitution variables to pass environment-specific values during deployment.

### Setup

1. **Define substitution variables in Cloud Build triggers:**
   - Go to Cloud Build → Triggers
   - Edit each trigger (dev, staging, prod)
   - Add substitution variables in the trigger configuration

2. **Update cloudbuild files to use substitutions:**

```yaml
# Example: cloudbuild.main.yaml
substitutions:
  _ENVIRONMENT: 'dev'
  _CORS_ORIGIN: 'https://dev.everredi.com'

steps:
  # ... build steps ...

  # Deploy with substitutions
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'everredi-api-${_ENVIRONMENT}'
      - '--set-env-vars'
      - 'NODE_ENV=production,CORS_ORIGIN=${_CORS_ORIGIN},PORT=8080'
```

### Pros

- Centralized configuration in GCP Console
- No sensitive data in code
- Easy to update without code changes
- Version controlled (via trigger config)

### Cons

- Requires manual setup in GCP Console
- Not visible in repository

## Approach 2: Environment-Specific Config Files in Repository

Store environment configurations as YAML/JSON files in the repository.

### Structure

```
backend/
  config/
    env.dev.yaml
    env.staging.yaml
    env.prod.yaml
```

### Example: `config/env.dev.yaml`

```yaml
environment: dev
cors:
  origin: 'https://dev.everredi.com'
api:
  baseUrl: 'https://api-dev.everredi.com'
```

### Update Cloud Build to Use Config Files

```yaml
# cloudbuild.main.yaml
steps:
  # Load environment config
  - name: 'gcr.io/cloud-builders/gcloud'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        # Parse YAML and set env vars (requires yq or similar)
        CORS_ORIGIN=$(yq eval '.cors.origin' config/env.dev.yaml)
        # Export for next steps
        echo "CORS_ORIGIN=${CORS_ORIGIN}" >> /workspace/env_vars.txt
        echo "DB_ID=${DB_ID}" >> /workspace/env_vars.txt

  # Deploy using loaded config
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        source /workspace/env_vars.txt
        gcloud run deploy everredi-api-dev \
          --set-env-vars "CORS_ORIGIN=${CORS_ORIGIN}"
```

### Pros

- Version controlled
- Visible in repository
- Easy to review changes
- Can use same structure across environments

### Cons

- Sensitive values shouldn't be in repo (use Secret Manager)
- Requires parsing YAML/JSON in build steps

## Approach 3: Secret Manager with Environment Prefixes

Store environment-specific secrets in Secret Manager with naming conventions.

### Naming Convention

```
stripe-secret-key-dev
stripe-secret-key-staging
stripe-secret-key-prod
```

### Update Cloud Build to Use Environment-Specific Secrets

```yaml
# cloudbuild.main.yaml
substitutions:
  _ENV: 'dev'

steps:
  # Deploy with environment-specific secrets
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'everredi-api-${_ENV}'
      - '--set-secrets'
      - STRIPE_SECRET_KEY=stripe-secret-key-${_ENV}:latest'
```

### Pros

- Environment isolation for secrets
- Follows security best practices
- Easy to rotate per environment

### Cons

- More secrets to manage
- Requires consistent naming

## Approach 4: Hybrid Approach (Recommended for Production)

Combine multiple approaches:

1. **Non-sensitive config**: Use Cloud Build substitution variables
2. **Secrets**: Use Secret Manager with environment prefixes
3. **Documentation**: Keep config structure in repo (without values)

### Implementation

#### 1. Create config template in repo:

```yaml
# config/env.template.yaml
environment: ${ENV}
cors:
  origin: ${CORS_ORIGIN}
secrets:
  # These are loaded from Secret Manager
  stripeSecretKey: stripe-secret-key-${ENV}
```

#### 2. Update Cloud Build files with substitutions:

```yaml
# cloudbuild.main.yaml
substitutions:
  _ENV: 'dev'
  _CORS_ORIGIN: 'https://dev.everredi.com'
  _DATABASE_ID: '(default)'

steps:
  # ... build steps ...

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'everredi-api-${_ENV}'
      - '--set-env-vars'
      - 'NODE_ENV=production,CORS_ORIGIN=${_CORS_ORIGIN},PORT=8080'
      - '--set-secrets'
      - 'STRIPE_SECRET_KEY=stripe-secret-key-${_ENV}:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret-${_ENV}:latest,GEMINI_API_KEY=gemini-api-key-${_ENV}:latest'
```

#### 3. Set substitution variables per trigger:

**Dev Trigger:**

- `_ENV`: `dev`
- `_CORS_ORIGIN`: `https://dev.everredi.com`
- `_DATABASE_ID`: `(default)`

**Staging Trigger:**

- `_ENV`: `staging`
- `_CORS_ORIGIN`: `https://staging.everredi.com`
- `_DATABASE_ID`: `staging`

**Production Trigger:**

- `_ENV`: `prod`
- `_CORS_ORIGIN`: `https://everredi.com`
- `_DATABASE_ID`: `prod`

## Approach 5: Using Cloud Run Service Configuration Files

Create service configuration files and apply them during deployment.

### Create service config files:

```yaml
# config/service.dev.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: everredi-api-dev
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: gcr.io/PROJECT_ID/everredi-api-dev:latest
          ports:
            - name: http1
              containerPort: 8080
          env:
            - name: NODE_ENV
              value: 'production'
              value: '(default)'
            - name: CORS_ORIGIN
              value: 'https://dev.everredi.com'
          resources:
            limits:
              cpu: '1'
              memory: 512Mi
```

### Deploy using config file:

```yaml
# cloudbuild.main.yaml
steps:
  # Replace PROJECT_ID in config file
  - name: 'gcr.io/cloud-builders/gcloud'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        sed "s/PROJECT_ID/$PROJECT_ID/g" config/service.dev.yaml > /workspace/service.yaml

  # Deploy using config file
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'services'
      - 'replace'
      - '/workspace/service.yaml'
      - '--region=us-central1'
```

### Pros

- Full control over service configuration
- Version controlled
- Can include all settings (CPU, memory, concurrency, etc.)

### Cons

- More verbose
- Requires YAML parsing/replacement

## Recommended Setup for This Project

For the Everredi api, I recommend **Approach 4 (Hybrid)**:

1. **Update cloudbuild files** to use substitution variables for non-sensitive config
2. **Use Secret Manager** with environment prefixes for secrets
3. **Set substitution variables** in each Cloud Build trigger

### Quick Setup Commands

```bash
# Set substitution variables for dev trigger
gcloud builds triggers update main-deploy-dev \
  --substitutions=_ENV=dev,_CORS_ORIGIN=https://dev.everredi.com,_DATABASE_ID="(default)"

# Set substitution variables for staging trigger
gcloud builds triggers update staging-deploy \
  --substitutions=_ENV=staging,_CORS_ORIGIN=https://staging.everredi.com,_DATABASE_ID=staging

# Set substitution variables for prod trigger
gcloud builds triggers update production-deploy \
  --substitutions=_ENV=prod,_CORS_ORIGIN=https://everredi.com,_DATABASE_ID=prod
```

## Best Practices

1. **Never commit secrets** to the repository
2. **Use Secret Manager** for all sensitive values
3. **Use substitution variables** for non-sensitive environment-specific config
4. **Document** environment differences in README or config template
5. **Version control** config structure (without values)
6. **Use consistent naming** for secrets across environments
7. **Rotate secrets** regularly, especially after team member changes
