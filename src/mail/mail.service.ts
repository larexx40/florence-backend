import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SendMailOptions } from './types/mail.types';
import { BullQueues, BullJobName } from 'src/common/constants/enum';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(
        @InjectQueue(BullQueues.MAIL) private readonly mailQueue: Queue<SendMailOptions>,
    ) {}

    async sendMail(options: SendMailOptions): Promise<void> {
        await this.mailQueue.add(BullJobName.SEND_MAIL, options, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false, // keep failed jobs for inspection
        });
        this.logger.log(`Mail job queued → ${options.to} | ${options.subject}`);
    }
}
