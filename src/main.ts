import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { EnvValidationService } from './config/env-validation.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate environment variables
  const envValidation = app.get(EnvValidationService);
  const validation = envValidation.validate();

  if (!validation.isValid) {
    console.error('❌ Missing required environment variables:');
    validation.missing.forEach((key) => {
      console.error(`   - ${key}`);
    });
    console.error('\n⚠️  Application may not function correctly.');
    console.error(
      '   Please check your .env file and ensure all required variables are set.\n',
    );
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    validation.warnings.forEach((warning) => {
      console.warn(`   ${warning}`);
    });
    console.warn('');
  }

  if (validation.isValid) {
    console.log('✅ Environment configuration validated');
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
  await app.listen(port);
  console.log(`Application is running on port ${port}/api`);
  console.log(`CORS enabled for origin: ${corsOrigin}`);
}
bootstrap();
