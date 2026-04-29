import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import * as pug from 'pug';
import { existsSync } from 'fs';
import { join } from 'path';
import { BUSINESS_DETAILS } from 'src/common/constants/business-details';
import { BullJobName, BullQueues } from 'src/common/constants/enum';
import { SendMailOptions } from './types/mail.types';

@Processor(BullQueues.MAIL)
export class MailProcessor {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly logoCid = 'everything-florence-logo';
  private readonly logoPath = join(__dirname, 'templates', 'assets', 'logo.png');
  private readonly assetsDir = join(__dirname, 'templates', 'assets');

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

  private renderTemplate(templateName: string, context: Record<string, any>, subject?: string): string {
    const templatePath = join(__dirname, 'templates', `${templateName}.pug`);
    return pug.renderFile(templatePath, this.buildTemplateContext({ subject, ...context }));
  }

  private buildTemplateContext(context: Record<string, any>): Record<string, any> {
    const appName = process.env.STORE_NAME || BUSINESS_DETAILS.name;
    const supportEmail =
      this.extractEmailAddress(process.env.SMTP_FROM) || 'noreply@everythingflorences.com';
    const storefrontUrl = process.env.STOREFRONT_URL || 'https://everythingflorences.com';
    const adminPortalUrl = process.env.ADMIN_PORTAL_URL || 'https://admin.everythingflorences.com';
    const resetUrl =
      context.resetToken && context.resetEmail
        ? `${storefrontUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(context.resetToken)}&email=${encodeURIComponent(context.resetEmail)}`
        : undefined;

    const socialLinks = BUSINESS_DETAILS.socialLinks.map((social) => ({
      ...social,
      iconSrc: `cid:${this.getSocialIconCid(social.icon)}`,
    }));

    return {
      appName,
      supportEmail,
      storefrontUrl,
      adminPortalUrl,
      resetUrl,
      logoSrc: `cid:${this.logoCid}`,
      business: {
        ...BUSINESS_DETAILS,
        socialLinks,
      },
      footerSignoff: `With care, The ${appName} Team`,
      ...context,
    };
  }

  private getSocialIconCid(iconName: string): string {
    return `everything-florence-social-${iconName}`;
  }

  private getInlineAttachments(): nodemailer.Attachment[] {
    const attachments: nodemailer.Attachment[] = [
      {
        filename: 'logo.png',
        path: this.logoPath,
        cid: this.logoCid,
      },
    ];

    for (const social of BUSINESS_DETAILS.socialLinks) {
      const iconPath = join(this.assetsDir, `${social.icon}.png`);
      if (!existsSync(iconPath)) continue;

      attachments.push({
        filename: `${social.icon}.png`,
        path: iconPath,
        cid: this.getSocialIconCid(social.icon),
      });
    }

    return attachments;
  }

  private extractEmailAddress(value?: string): string | undefined {
    if (!value) return undefined;

    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim();
  }

  private getSenderAddress(): string {
    const email =
      this.extractEmailAddress(process.env.SMTP_FROM) || 'noreply@everythingflorences.com';

    return `"${BUSINESS_DETAILS.name}" <${email}>`;
  }

  @Process(BullJobName.SEND_MAIL)
  async handleSendMail(job: Job<SendMailOptions>): Promise<void> {
    const { to, subject, template, context = {}, htmlBody } = job.data;

    let html = htmlBody;
    if (!html && template) {
      html = this.renderTemplate(template, context, subject);
    }
    if (!html) {
      this.logger.error(`Job ${job.id}: neither "htmlBody" nor "template" was provided`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.getSenderAddress(),
        to,
        subject,
        html,
        attachments: this.getInlineAttachments(),
      });
      this.logger.log(`Mail sent to ${to} - subject: "${subject}"`);
    } catch (err) {
      this.logger.error(err, `Failed to send mail to ${to} - subject: "${subject}"`);
      throw err;
    }
  }
}
