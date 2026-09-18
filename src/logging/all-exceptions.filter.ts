import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggingService } from './logging.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private loggingService: LoggingService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { user?: { id?: number } }>();
    const response = ctx.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : { message: 'Internal server error' };
    const error = exception instanceof Error ? exception : new Error(String(exception));

    const meta = {
      method: request.method,
      url: request.originalUrl || request.url,
      statusCode: status,
      userId: request.user?.id,
    };

    if (status >= 500) {
      this.loggingService.error(error.message, error.stack, 'ExceptionFilter', meta);
    } else {
      this.loggingService.warn(error.message, 'ExceptionFilter', meta);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      ...(typeof body === 'object' ? body : { message: body }),
    });
  }
}
