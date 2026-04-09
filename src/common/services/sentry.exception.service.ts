import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import axios from 'axios';
import { IncidenceType, IncidentSeverity } from '../constants/enum';

@Injectable()
export class SentryExceptionService {
    private readonly logger = new Logger(SentryExceptionService.name);

    constructor() {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV,
        });
    }

    async captureException({
        error,
        context,
        user,
        extra,
        incident,
    }: {
        error: any;
        context?: string;
        user?: { id: string; email?: string; name?: string };
        extra?: Record<string, any>;
            incident?: { type: IncidenceType; message: string; severity?: IncidentSeverity };
    }) {
        try {
            // Log to Sentry
            Sentry.captureException(error, {
                user,
                extra: { context, ...extra },
                tags: { type: incident?.type, severity: incident?.severity },
            });

            // Optionally also alert Slack for critical or high-severity issues
            if (process.env.NODE_ENV === 'production' && (incident.severity === IncidentSeverity.CRITICAL || incident?.severity === IncidentSeverity.HIGH)) {
                await this.notifySlack(incident, extra, user);
            }
        } catch (e) {
            this.logger.error('Failed to send error to Sentry or Slack', e);
        }
    }

    private async notifySlack(
        incident: { message: string; type?: string; severity?: string },
        extra?: Record<string, any>,
        user?: { id: string; email?: string; name?: string },
    ) {
        const webhook = process.env.SLACK_ERROR_WEBHOOK_URL;
        if (!webhook) return;

        const payload = {
            text: `🚨 *${incident.severity?.toUpperCase() || 'ERROR'}* – ${incident.message}`,
            attachments: [
                {
                    color: incident.severity === IncidentSeverity.CRITICAL ? 'danger' : 'warning',
                    fields: [
                        ...(user
                            ? [
                                { title: 'User', value: `${user.name || ''} (${user.email || user.id})`, short: false },
                            ]
                            : []),
                        ...Object.entries(extra || {}).map(([key, value]) => ({
                            title: key,
                            value: JSON.stringify(value, null, 2),
                            short: false,
                        })),
                    ],
                },
            ],
        };

        try {
            await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.error('Failed to send Slack notification:', err);
        }
    }
}
