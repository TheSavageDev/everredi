import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 5051);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`EverRedi API listening on http://localhost:${port}/api`);
}

bootstrap();
