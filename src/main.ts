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

  const config = new DocumentBuilder()
    .setTitle('Florence API')
    .setDescription('Florence vendor e-commerce backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const port = process.env.PORT || 3001;
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);


  await app.listen(port, () => {
    const logger = new Logger()
    logger.log(`Server is running on http://localhost:${port}`);
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  });
}
bootstrap();
