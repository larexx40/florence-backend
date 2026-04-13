import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
