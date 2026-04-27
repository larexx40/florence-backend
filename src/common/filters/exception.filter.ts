import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalHttpExceptionFilter.name);
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp ? exception.getResponse() : 'Internal server error';
    const error = typeof message === 'string' ? message : (message as any).message || 'Unknown error';

    // 5xx = server fault → error; 4xx = client mistake → warn (less noise)
    if (status >= 500) {
      this.logger.error(
        { err: exception, path: request.url, statusCode: status },
        'Unhandled server error',
      );
    } else {
      this.logger.warn(
        { path: request.url, statusCode: status },
        error,
      );
    }

    const stack = process.env.NODE_ENV !== 'production' ? exception.stack : undefined;

    response.status(status).json({
      status: false,
      statusCode: status,
      message: error,
      error: exception.name || 'Error',
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(stack && { stack }),
    });
  }
}
