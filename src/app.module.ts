import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { pinoConfig } from './logger/logger.config';
import { GlobalHttpExceptionFilter } from './common/filters/exception.filter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { AppCacheModule } from './cache/cache.module';
import { LocationModule } from './location/location.module';
import { LogisticsModule } from './logistics/logistics.module';
import { ShippingAddressModule } from './shipping-address/shipping-address.module';
import { MailModule } from './mail/mail.module';
import { SeedModule } from './seed/seed.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { ImageModule } from './image/image.module';
import { CheckoutModule } from './checkout/checkout.module';
import { OrderModule } from './order/order.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        // short burst: max 20 req / 10 s per IP
        name: 'short',
        ttl: parseInt(process.env.THROTTLE_SHORT_TTL ?? '10000', 10),
        limit: parseInt(process.env.THROTTLE_SHORT_LIMIT ?? '20', 10),
      },
      {
        // sustained: max 200 req / 60 s per IP
        name: 'long',
        ttl: parseInt(process.env.THROTTLE_LONG_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LONG_LIMIT ?? '200', 10),
      },
    ]),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    LoggerModule.forRoot(pinoConfig),
    AppCacheModule,
    AuthModule,
    PrismaModule,
    ProductModule,
    CategoryModule,
    LocationModule,
    LogisticsModule,
    ShippingAddressModule,
    MailModule,
    SeedModule,
    AdminModule,
    UsersModule,
    ImageModule,
    CheckoutModule,
    OrderModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    GlobalHttpExceptionFilter,
    // API key check runs first on every request
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    // rate limiting runs after API key is validated
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PrismaService],
})
export class AppModule {}
