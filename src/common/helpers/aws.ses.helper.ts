import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { InternalServerErrorException } from '@nestjs/common';
import * as pug from 'pug';

const sesClient = new SESClient({
    region: process.env.AWS_SES_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * Send an email using AWS SES.
 * @param to Recipient email address
 * @param subject Subject of the email
 * @param options Dynamic options to define email body as direct HTML or from a Pug template
 * @param options.html Direct HTML content for the email body
 * @param options.template Path to the Pug template (optional)
 * @param options.context Context for rendering the Pug template (optional)
 */
export async function sendEmail(
    to: string,
    subject: string,
    options: { html?: string; template?: string; context?: Record<string, unknown> },
): Promise<void> {
    let body: string;

    try {
        // Render Pug template if provided, otherwise use the provided HTML directly
        if (options.template) {
            if (!options.context) {
                throw new Error('Context is required when using a Pug template.');
            }
            body = pug.renderFile(options.template, options.context);
        } else if (options.html) {
            body = options.html;
        } else {
            throw new Error('Either HTML or Pug template must be provided.');
        }

        const params = {
            Destination: {
                ToAddresses: [to],
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: body,
                    },
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject,
                },
            },
            Source: process.env.AWS_SES_SENDER_EMAIL, // Verified sender email address in SES
        };

        const command = new SendEmailCommand(params);
        await sesClient.send(command);
        console.log('Email sent successfully.');
    } catch (error) {
        console.error('Error sending email:', error);
        throw new InternalServerErrorException('Failed to send email.');
    }
}
