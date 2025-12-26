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
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });

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
    logger.log(`🌐 CORS enabled for origin: ${corsOrigin}`);
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
