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

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
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
      }
    } catch (error) {
      logger.warn('⚠️  Environment validation failed:', error);
      // Continue anyway - some services might still work
    }

    // Enable CORS
    // Use ConfigService to properly read environment variables (especially in Cloud Run)
    const corsOrigin =
      configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';

    // Support multiple origins (comma-separated) or single origin
    const allowedOrigins = corsOrigin.split(',').map((origin) => origin.trim());

    // In staging/production, also allow the Cloud Run service URL
    // This allows both the vanity URL and the default Cloud Run URL to work
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    if (isProduction) {
      // Get the Cloud Run service name from environment
      // K_SERVICE is set by Cloud Run (e.g., "everredi-api-staging")
      const serviceName = process.env.K_SERVICE;

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

          // Allow if origin is in the explicitly allowed list
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }

          // Allow if origin matches Cloud Run URL pattern for this service
          // Pattern: https://<service-name>-<hash>-<region>.a.run.app
          if (
            serviceName &&
            origin.includes(serviceName) &&
            origin.endsWith('.a.run.app')
          ) {
            callback(null, true);
            return;
          }

          // Reject all other origins
          callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
      });
    } else {
      // Development: use simple origin matching
      app.enableCors({
        origin:
          allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
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
    logger.log(`🌐 CORS enabled for origins: ${allowedOrigins.join(', ')}`);
    if (isProduction) {
      logger.log(`   Also allowing Cloud Run service URL pattern`);
    }
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
