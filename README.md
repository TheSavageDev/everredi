# Everredi API

API for the Everredi emergency preparedness application, built with NestJS, Supabase, and Google Cloud Platform.

## Overview

The EverRedi API provides RESTful APIs for managing emergency preparedness kits, inventory items, locations, supplies, and user subscriptions. It integrates with Supabase (PostgreSQL + Auth), Stripe, and Google Cloud services.

## Prerequisites

- **Node.js**: >= 24.0.0 (LTS)
- **npm**: >= 11.0.0
- **Google Cloud Project**: With billing enabled
- **Supabase Project**: Configured with PostgreSQL database
- **Supabase Service Role Key**: For admin operations

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
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key

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

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and service role key from Project Settings → API
3. Run the database migration: `api/migrations/000_consolidated_schema.sql`
4. Configure OAuth providers in Supabase Dashboard → Authentication → Providers

**Note**: The service role key has admin privileges. Keep it secret and never expose it to the frontend.

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
│   └── guards/            # Auth guards (Supabase)
├── config/                # Configuration modules
│   ├── supabase.provider.ts # Supabase client setup
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

- Supabase Authentication integration
- Protected routes with `@UseGuards(SupabaseAuthGuard)`
- Current user decorator `@CurrentUser()`
- JWT token validation

### Inventory Management

- CRUD operations for inventory items
- Consolidated model: single `inventory_items` table handles both kit items and inventory
- Expiration date and lot code tracking stored directly on `inventory_items` (no separate lots table)
- Automatic expiration notifications (configurable warning days)
- Purchase date tracking

### Emergency Kits

- Pre-built kit templates with versioning
- User-created custom kits
- Kit items stored in `inventory_items` with `kit_id` set
- Public template sharing
- Template revisions for version control

### Notifications

- Push notification support
- Expiration alerts via cron jobs
- Device token management
- In-app notification tracking
- Notification preferences per tenant

### Subscriptions

- Stripe integration
- Subscription management
- Webhook handling
- RevenueCat sync support

### AI Integration

- Google Gemini AI for intelligent features
- Configurable model selection
- AI-generated kit recommendations

## Database

The API uses Supabase PostgreSQL for data storage. Each environment uses a separate Supabase project:

- **Dev**: Development Supabase project
- **Staging**: Staging Supabase project
- **Production**: Production Supabase project

### Database Migrations

See [migrations/README.md](./migrations/README.md) for migration documentation.

For new installations, run the consolidated migration:
```bash
psql -h your-supabase-host -U postgres -d your-database -f migrations/000_consolidated_schema.sql
```

### Schema Documentation

See [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) in the project root for complete schema documentation.

## Deployment

The API is deployed to Google Cloud Run with automated CI/CD via Cloud Build.

### Environments

- **Dev/Test**: Deployed from `main` branch → `everredi-api-dev`
- **Staging**: Deployed from `rc_*` tags → `everredi-api-staging`
- **Production**: Deployed from `prod_*` tags → `everredi-api-prod`

### Deployment Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions, including:

- Cloud Build setup
- Service account configuration
- Environment variable management
- Supabase project configuration

### Environment Management

See [ENV_MANAGEMENT.md](./ENV_MANAGEMENT.md) for detailed information on managing environment-specific configurations.

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

All protected endpoints require a valid Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <supabase-jwt-token>
```

The token is validated using Supabase's JWT verification.

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

### Supabase Connection Issues

- Verify `SUPABASE_URL` matches your Supabase project URL
- Check that `SUPABASE_SECRET_KEY` is the service role key (not the anon key)
- Ensure the database migration has been run
- Check Supabase project status in the dashboard

### Port Already in Use

Change the `PORT` in your `.env` file or stop the process using the port.

### Permission Errors

For Cloud Build and deployment issues, see [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section.

## License

Private - UNLICENSED
