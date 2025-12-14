import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TemplateSeedService } from './template-seed.service';

async function bootstrap() {
  console.log('🚀 Initializing NestJS application...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const seedService = app.get(TemplateSeedService);

  try {
    // Check for --force flag
    const force = process.argv.includes('--force');
    if (force) {
      console.log('🔄 Force mode enabled - will update existing templates');
    }
    await seedService.seedDefaultTemplates(force);
    console.log('✅ Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
