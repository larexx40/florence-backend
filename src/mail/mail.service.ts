import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as pug from 'pug';
import { join } from 'path';
import { SendMailOptions } from './types/mail.types';

@Injectable()
export class MailService {
    private readonly transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10),
            secure: false, // Use true for port 465
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

    async sendMail(options: SendMailOptions): Promise<void> {
        const { to, subject, template, context = {}, htmlBody } = options;

        let html = htmlBody; // Use provided HTML body

        if (!html && template) {
            // If HTML body is not provided, fallback to rendering the template
            html = this.renderTemplate(template, context);
        }

        if (!html) {
            // If neither template nor HTML body is provided, throw an error
            throw new Error('Either "htmlBody" or "template" must be provided.');
        }

        try{
            const send = await this.transporter.sendMail({
                from: process.env.SMTP_FROM,
                to,
                subject,
                html,
            });
            
            console.log("SEND MAIL: ", send)
        } catch (err) {
            console.error('Failed to send email:', err);
        }
    }
}
