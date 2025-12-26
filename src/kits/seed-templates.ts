import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { TemplateSeedService } from './template-seed.service';

const logger = new Logger('SeedTemplates');

async function bootstrap() {
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
    await seedService.seedDefaultTemplates(force);
    logger.log('✅ Seeding completed successfully');
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

bootstrap();
