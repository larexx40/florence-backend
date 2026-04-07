import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        console.log("Exception Error: ", exception)
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const isHttp = exception instanceof HttpException;
        const status = isHttp
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const message = isHttp
            ? exception.getResponse()
            : 'Internal server error';

        const error =
            typeof message === 'string'
                ? message
                : (message as any).message || 'Unknown error';

        const stack = process.env.NODE_ENV !== 'production' ? exception.stack : '';
        if (process.env.NODE_ENV !== 'production') {
            console.error('❌ Exception caught:', exception);
        }

        response.status(status).json({
            status: false,
            statusCode: status,
            message: error,
            error: exception.name || 'Error',
            path: request.url,
            timestamp: new Date().toISOString(),
            stack: stack,
        });
    }
}
  