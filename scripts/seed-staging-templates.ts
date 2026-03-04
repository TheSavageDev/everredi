import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TemplateSeedService } from '../src/kits/template-seed.service';

const logger = new Logger('SeedStagingTemplates');

async function bootstrap() {
  // CRITICAL: Set environment variables BEFORE NestJS initializes
  // ConfigService reads these during module initialization

  logger.log('🌱 Seeding kit templates to staging environment');

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
