import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from './common/filters/exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.ADMIN_URL,
      process.env.CLIENT_URL,
    ].filter(Boolean) as string[],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Florence API')
    .setDescription('Florence vendor e-commerce backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();

  const port = process.env.PORT || 3000;
  const document = SwaggerModule.createDocument(app, config);
  // require x-api-key on every operation in the Swagger UI
  document.security = [{ 'x-api-key': [] }];
  SwaggerModule.setup('api/docs', app, document);


  await app.listen(port, () => {
    const logger = new Logger()
    logger.log(`Server is running on http://localhost:${port}`);
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  });
}
bootstrap();
