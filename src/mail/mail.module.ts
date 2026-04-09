import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { BullQueues } from 'src/common/constants/enum';

@Module({
    imports: [
        BullModule.registerQueue({ name: BullQueues.MAIL }),
    ],
    providers: [MailService, MailProcessor],
    exports: [MailService],
})
export class MailModule {}
