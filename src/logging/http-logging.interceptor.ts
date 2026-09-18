import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { LoggingService } from './logging.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id?: number } }>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;

        this.loggingService.log(`${request.method} ${request.originalUrl || request.url}`, 'HTTP', {
          statusCode: response.statusCode,
          durationMs,
          userId: request.user?.id,
          ip: request.ip,
        });
      }),
    );
  }
}
