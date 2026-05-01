import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { OptionalAuthGuard } from 'src/guards/optional-auth.guard';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [PrismaModule, HttpModule, MailModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, OptionalAuthGuard],
})
export class CheckoutModule {}
