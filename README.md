# Everredi API

API for the Everredi emergency preparedness application, built with NestJS, Firebase, and Google Cloud Platform.

## Overview

The EverRedi api provides RESTful APIs for managing emergency preparedness kits, inventory items, locations, supplies, and user subscriptions. It integrates with Firebase Authentication, Firestore, Stripe, and Google Cloud services.

## Prerequisites

- **Node.js**: >= 24.0.0 (LTS)
- **npm**: >= 11.0.0
- **Google Cloud Project**: With billing enabled
- **Firebase Project**: Configured with Firestore
- **Service Account**: Firebase Admin SDK credentials (JSON key file)

## Installation

```bash
# Install dependencies
npm install
```

## Environment Configuration

Copy the example environment file and configure it:

```bash
cp env.example .env
```

Update `.env` with your configuration:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_DATABASE_ID=(default)

# Server Configuration
PORT=5051
CORS_ORIGIN=http://localhost:3000

# Stripe Configuration
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Gemini AI Configuration
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.0-pro
```

### Firebase Service Account

Place your Firebase service account JSON key file in the project root (e.g., `everredi-dev.json`). The file will be automatically loaded by the Firebase configuration module.

**Note**: Service account JSON files are excluded from git via `.gitignore` for security.

## Development

```bash
# Start in development mode (with hot reload)
npm run start:dev

# Start in debug mode
npm run start:debug

# Build the project
npm run build

# Start production build locally
npm run start:prod
```

The API will be available at `http://localhost:5051` (or the port specified in your `.env`).

### Health Check

```bash
curl http://localhost:5051/health
```

## Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e

# Generate test coverage
npm run test:cov
```

## Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
src/
├── ai/                    # AI/Gemini integration
├── auth/                  # Authentication endpoints
├── common/                # Shared decorators and guards
│   ├── decorators/        # Custom decorators (e.g., @CurrentUser)
│   └── guards/            # Auth guards (Firebase)
├── config/                # Configuration modules
│   ├── firebase.config.ts # Firebase Admin SDK setup
│   └── ...
├── inventory/             # Inventory item management
├── kits/                  # Emergency kit templates and user kits
├── locations/             # Location management
├── notifications/         # Push notifications and expiration alerts
├── subscriptions/         # Stripe subscription management
├── supplies/              # Supply item management
├── supply-categories/    # Supply category management
└── users/                 # User profile management
```

## Key Features

### Authentication

- Firebase Authentication integration
- Protected routes with `@UseGuards(FirebaseAuthGuard)`
- Current user decorator `@CurrentUser()`

### Inventory Management

- CRUD operations for inventory items
- Expiration date tracking
- Automatic expiration notifications (60, 30, 10, 1 days before expiration)
- Purchase date tracking

### Emergency Kits

- Pre-built kit templates
- User-created custom kits
- Kit item management
- Public template sharing

### Notifications

- Push notification support
- Expiration alerts via cron jobs
- Device token management
- In-app notification tracking

### Subscriptions

- Stripe integration
- Subscription management
- Webhook handling

### AI Integration

- Google Gemini AI for intelligent features
- Configurable model selection

## Deployment

The api is deployed to Google Cloud Run with automated CI/CD via Cloud Build.

### Environments

- **Dev/Test**: Deployed from `main` branch → `everredi-api-dev`
- **Staging**: Deployed from `rc_*` tags → `everredi-api-staging`
- **Production**: Deployed from `prod_*` tags → `everredi-api-prod`

### Deployment Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions, including:

- Cloud Build setup
- Service account configuration
- Environment variable management
- Firestore database configuration

### Environment Management

See [ENV_MANAGEMENT.md](./ENV_MANAGEMENT.md) for detailed information on managing environment-specific configurations.

## Database

The api uses Firestore (Firebase) for data storage. Each environment uses a separate Firestore database:

- **Dev**: `(default)` database
- **Staging**: `staging` database
- **Production**: `prod` database

## Scheduled Jobs

The application uses NestJS Schedule for cron-based jobs:

- **Expiration Notifications**: Runs daily at 9 AM to check for expiring inventory items and send notifications

## API Documentation

### Health Check

```
GET /health
```

Returns service status and environment information.

### Authentication

All protected endpoints require a valid Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

## Scripts

### Template Management

```bash
# Seed kit templates
npm run seed:templates

# Verify template items
npm run verify:templates

# Verify public templates
npm run verify:public
```

## Docker

The project includes a Dockerfile for containerization:

```bash
# Build Docker image
docker build -t everredi-api .

# Run container
docker run -p 8080:8080 --env-file .env everredi-api
```

## Troubleshooting

### Firebase Connection Issues

- Verify your service account JSON file is in the project root
- Check that `FIREBASE_PROJECT_ID` matches your Firebase project
- Ensure Firestore is enabled in your Firebase project

### Port Already in Use

Change the `PORT` in your `.env` file or stop the process using the port.

### Permission Errors

For Cloud Build and deployment issues, see [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section.

## License

Private - UNLICENSED
