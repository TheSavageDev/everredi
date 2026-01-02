#!/usr/bin/env ts-node
/**
 * Seed kit templates to staging environment
 *
 * Usage:
 *   npm run seed:staging
 *   npm run seed:staging -- --force  # Force update existing templates
 *
 * Environment Variables:
 *   FIREBASE_PROJECT_ID - Firebase project ID (default: everredi-dev)
 *   FIREBASE_DATABASE_ID - Firestore database ID (default: staging)
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to service account key (optional, uses ADC if not set)
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TemplateSeedService } from '../src/kits/template-seed.service';

const logger = new Logger('SeedStagingTemplates');

async function bootstrap() {
  // CRITICAL: Set environment variables BEFORE NestJS initializes
  // ConfigService reads these during module initialization
  const projectId = process.env.FIREBASE_PROJECT_ID || 'everredi-dev';
  const databaseId = process.env.FIREBASE_DATABASE_ID || 'staging';

  // Ensure these are set in process.env so ConfigService can read them
  if (!process.env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = projectId;
  }
  if (!process.env.FIREBASE_DATABASE_ID) {
    process.env.FIREBASE_DATABASE_ID = databaseId;
  }

  logger.log('🌱 Seeding kit templates to staging environment');
  logger.log(`   Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
  logger.log(`   Database ID: ${process.env.FIREBASE_DATABASE_ID}`);

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    logger.log('   Using Application Default Credentials (ADC)');
  } else {
    logger.log(
      `   Using credentials from: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`,
    );
  }

  logger.log('🚀 Initializing NestJS application...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const seedService = app.get(TemplateSeedService);

  try {
    // Check for --force flag
    const force = process.argv.includes('--force');
    if (force) {
      logger.log('🔄 Force mode enabled - will update existing templates');
    }

    logger.log('📦 Starting template seeding...');
    const result = await seedService.seedDefaultTemplates(force);

    logger.log('✅ Seeding completed successfully');
    logger.log(`   Created: ${result.created}`);
    logger.log(`   Updated: ${result.updated}`);
    logger.log(`   Skipped: ${result.skipped}`);

    process.exit(0);
  } catch (error) {
    logger.error(
      '❌ Seeding failed:',
      error instanceof Error ? error.stack : String(error),
    );
    process.exit(1);
  } finally {
    await app.close();
  }
}

void bootstrap();
