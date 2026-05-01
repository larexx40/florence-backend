import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [WebhookService],
  controllers: [WebhookController],
})
export class WebhookModule {}
