import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function resolveCorsOrigin():
  | boolean
  | string
  | RegExp
  | Array<string | RegExp> {
  const configured = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.includes('*')) {
    return true;
  }

  const origins: Array<string | RegExp> = configured.length
    ? configured
    : ['http://localhost:3000'];

  // Preview + production deployments on Vercel (mobile / local tooling may still
  // call the public /api surface from another origin).
  if (process.env.VERCEL === '1') {
    origins.push(/^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i);
  }

  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 5051);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`EverRedi API listening on http://localhost:${port}/api`);
}

bootstrap();
