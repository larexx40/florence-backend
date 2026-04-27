import { Params } from 'nestjs-pino';
import { v4 as uuid } from 'uuid';

const env = process.env.NODE_ENV ?? 'development';
const isDev = env === 'development';

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(3)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3);
  return `${minutes}m ${seconds}s`;
}

export const pinoConfig: Params = {
  pinoHttp: {
    level: isDev ? 'debug' : 'info',

    // Use incoming x-request-id header when present; otherwise generate one
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? uuid(),

    // Attach per-request context fields to every log line in that request
    customProps: (req: any) => ({
      env,
      userId: req.user?.userId ?? undefined,
    }),

    // Keep request/response serialisation minimal — no body logging
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },

    customSuccessObject: (_req, _res, val) => ({
      ...val,
      responseTime: formatResponseTime(val.responseTime as number),
    }),

    customErrorObject: (_req, _res, _err, val) => ({
      ...val,
      responseTime: formatResponseTime(val.responseTime as number),
    }),

    // Suppress health-check endpoint noise
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },

    // Redact sensitive headers before they reach any log sink
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },

    // Human-readable output in development; raw JSON in staging / production
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageFormat: '[{context}] {msg}',
          },
        }
      : undefined,
  },
};
