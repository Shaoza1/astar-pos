import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the React frontend origin — tighten in production via env var
  app.enableCors();

  // All routes are prefixed so the root path is never accidentally exposed
  app.setGlobalPrefix('api/v1');

  // whitelist strips unknown properties; transform coerces plain objects to DTO class instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // PORT loaded from environment variables — never hardcode
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
