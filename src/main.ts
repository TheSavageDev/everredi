import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { EnvValidationService } from './config/env-validation.service';
import { ConfigService } from '@nestjs/config';
import { initializeSentry } from './config/sentry.config';
import * as Sentry from '@sentry/node';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  try {
    logger.log('🚀 Starting EverRedi API...');
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`PORT: ${process.env.PORT || '8080'}`);

    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';

    const app = await NestFactory.create(AppModule, {
      logger: isProduction
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Initialize Sentry before other services
    const configService = app.get(ConfigService);
    initializeSentry(configService);

    // Validate environment variables
    try {
      const envValidation = app.get(EnvValidationService);
      const validation = envValidation.validate();

      if (!validation.isValid) {
        logger.error('❌ Missing required environment variables:');
        validation.missing.forEach((key) => {
          logger.error(`   - ${key}`);
        });
        logger.error('\n⚠️  Application may not function correctly.');
        logger.error(
          '   Please check your .env file and ensure all required variables are set.\n',
        );
      }

      if (validation.warnings.length > 0) {
        logger.warn('⚠️  Environment warnings:');
        validation.warnings.forEach((warning) => {
          logger.warn(`   ${warning}`);
        });
        logger.warn('');
      }

      if (validation.isValid) {
        logger.log('✅ Environment configuration validated');
      } else if (isProduction) {
        logger.error(
          '❌ Environment validation failed in production. Shutting down application.',
        );
        throw new Error('Missing required environment variables');
      }
    } catch (error) {
      logger.warn('⚠️  Environment validation failed:', error);
      // Continue anyway - some services might still work
    }

    // Enable CORS
    // Use ConfigService to properly read environment variables (especially in Cloud Run)
    const corsOriginRaw = configService.get<string>('CORS_ORIGIN');
    const corsOriginFromEnv = process.env.CORS_ORIGIN;
    const corsOrigin =
      corsOriginRaw || corsOriginFromEnv || 'http://localhost:3000';

    // Log CORS configuration for debugging
    logger.log(`🌐 CORS configuration:`);
    logger.log(
      `   CORS_ORIGIN from ConfigService: ${corsOriginRaw || '(not set)'}`,
    );
    logger.log(
      `   CORS_ORIGIN from process.env: ${corsOriginFromEnv || '(not set)'}`,
    );
    logger.log(`   Resolved CORS_ORIGIN: ${corsOrigin}`);

    // Log all environment variables that start with CORS for debugging
    const corsEnvVars = Object.keys(process.env)
      .filter((key) => key.toUpperCase().includes('CORS'))
      .map((key) => `${key}=${process.env[key]}`);
    if (corsEnvVars.length > 0) {
      logger.log(`   All CORS-related env vars: ${corsEnvVars.join(', ')}`);
    }

    // Warn if there's a mismatch between ConfigService and process.env
    if (
      corsOriginRaw &&
      corsOriginFromEnv &&
      corsOriginRaw !== corsOriginFromEnv
    ) {
      logger.warn(
        `   ⚠️  Mismatch detected: ConfigService="${corsOriginRaw}" vs process.env="${corsOriginFromEnv}"`,
      );
    }

    // Helper function to normalize origins (lowercase, remove trailing slashes)
    const normalizeOrigin = (origin: string): string => {
      return origin.trim().toLowerCase().replace(/\/$/, '');
    };

    // Support multiple origins (comma-separated) or single origin
    const allowedOriginsRaw = corsOrigin
      .split(',')
      .map((origin) => origin.trim());
    const allowedOrigins = allowedOriginsRaw.map(normalizeOrigin);

    logger.log(`   Allowed origins (normalized): ${allowedOrigins.join(', ')}`);

    // In staging/production, also allow the Cloud Run service URL
    // This allows both the vanity URL and the default Cloud Run URL to work
    if (isProduction) {
      // Get the Cloud Run service name from environment
      // K_SERVICE is set by Cloud Run (e.g., "everredi-api-staging")
      const serviceName = process.env.K_SERVICE;
      logger.log(`   Cloud Run service name: ${serviceName || '(not set)'}`);

      // Cloud Run URLs have format: https://<service-name>-<hash>-<region>.a.run.app
      // We'll match any URL that contains the service name and ends with .a.run.app
      app.enableCors({
        origin: (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          // Allow requests with no origin (e.g., mobile apps, Postman)
          if (!origin) {
            callback(null, true);
            return;
          }

          const normalizedOrigin = normalizeOrigin(origin);

          // Allow if origin is in the explicitly allowed list (case-insensitive)
          if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
            return;
          }

          // Allow if origin matches Cloud Run URL pattern for this service
          // Pattern: https://<service-name>-<hash>-<region>.a.run.app
          if (
            serviceName &&
            normalizedOrigin.includes(serviceName.toLowerCase()) &&
            normalizedOrigin.endsWith('.a.run.app')
          ) {
            callback(null, true);
            return;
          }

          // Reject all other origins
          logger.warn(
            `CORS: ❌ Rejected origin "${origin}" (normalized: "${normalizedOrigin}")`,
          );
          logger.warn(`   Allowed origins: ${allowedOrigins.join(', ')}`);
          if (serviceName) {
            logger.warn(
              `   Or Cloud Run URLs matching: *${serviceName}*.a.run.app`,
            );
          }
          callback(
            new Error(
              `Not allowed by CORS: origin "${origin}" is not in the allowed list`,
            ),
          );
        },
        credentials: true,
      });
    } else {
      // Development: use simple origin matching (case-insensitive)
      logger.log(`   Development mode: using simple origin matching`);
      app.enableCors({
        origin: (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          if (!origin) {
            callback(null, true);
            return;
          }

          const normalizedOrigin = normalizeOrigin(origin);
          if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
            return;
          }

          logger.warn(`CORS: ❌ Rejected origin "${origin}"`);
          callback(
            new Error(
              `Not allowed by CORS: origin "${origin}" is not in the allowed list`,
            ),
          );
        },
        credentials: true,
      });
    }

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Global prefix
    app.setGlobalPrefix('api');

    // Cloud Run sets PORT automatically, default to 8080
    const port = process.env.PORT || 8080;

    logger.log(`📡 Starting server on port ${port}...`);
    await app.listen(port);

    logger.log(`✅ Application is running on port ${port}/api`);
    logger.log(
      `🏥 Health check available at: http://0.0.0.0:${port}/api/health`,
    );
  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    logger.error(
      'Stack trace:',
      error instanceof Error ? error.stack : 'No stack trace',
    );

    // Capture startup errors in Sentry
    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        phase: 'bootstrap',
      },
    });

    process.exit(1);
  }
}

bootstrap().catch((error) => {
  logger.error('❌ Unhandled error during bootstrap:', error);

  // Capture unhandled bootstrap errors
  Sentry.captureException(error, {
    level: 'fatal',
    tags: {
      phase: 'bootstrap',
    },
  });

  process.exit(1);
});
