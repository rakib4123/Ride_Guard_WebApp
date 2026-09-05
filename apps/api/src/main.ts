import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({ origin: origins });

  // Swagger is served outside production unless explicitly enabled, so the
  // deployed API does not advertise its surface to anonymous callers.
  const docsEnabled =
    process.env.ENABLE_API_DOCS === 'true' || process.env.NODE_ENV !== 'production';
  if (docsEnabled) {
    const config = new DocumentBuilder()
      .setTitle('RideGuard API')
      .setDescription('Risk scoring + trip logging for the RideGuard rider app.')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`RideGuard API on http://localhost:${port}/api`);
}
bootstrap();
