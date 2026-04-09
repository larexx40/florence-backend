import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import * as pug from 'pug';
import { join } from 'path';
import { SendMailOptions } from './types/mail.types';
import { BullJobName, BullQueues } from 'src/common/constants/enum';

@Processor(BullQueues.MAIL)
export class MailProcessor {
    private readonly logger = new Logger(MailProcessor.name);
    private readonly transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10),
            secure: false,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }

    private renderTemplate(templateName: string, context: Record<string, any>): string {
        const templatePath = join(__dirname, 'templates', `${templateName}.pug`);
        return pug.renderFile(templatePath, context);
    }

    @Process(BullJobName.SEND_MAIL)
    async handleSendMail(job: Job<SendMailOptions>): Promise<void> {
        const { to, subject, template, context = {}, htmlBody } = job.data;

        let html = htmlBody;
        if (!html && template) {
            html = this.renderTemplate(template, context);
        }
        if (!html) {
            this.logger.error(`Job ${job.id}: neither "htmlBody" nor "template" was provided`);
            return;
        }

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM,
                to,
                subject,
                html,
            });
            this.logger.log(`Mail sent to ${to} — subject: "${subject}"`);
        } catch (err) {
            this.logger.error(`Failed to send mail to ${to}: ${err.message}`, err.stack);
            // re-throwing lets Bull retry the job according to its backoff config
            throw err;
        }
    }
}
