import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { MailService } from 'src/mail/mail.service';

@Module({
  providers: [AdminService, MailService],
  controllers: [AdminController]
})
export class AdminModule {}
