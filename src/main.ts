import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as NestLogger, ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { GlobalHttpExceptionFilter } from './common/filters/exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(app.get(GlobalHttpExceptionFilter));

  app.enableCors({
    origin: (origin, callback) => {
      const allowed = [
        /^https?:\/\/([\w-]+\.)*everythingflorences\.com$/,
        /^http:\/\/localhost:\d+$/,
      ];
      if (!origin || allowed.some((pattern) => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Cache-Control', 'Pragma', 'Accept'],
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
    const logger = new NestLogger('Bootstrap');
    logger.log(`Server is running on http://localhost:${port}`);
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  });
}
bootstrap();
