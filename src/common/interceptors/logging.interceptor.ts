import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import * as Sentry from '@sentry/node';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const startTime = Date.now();

    // Add breadcrumb for request
    Sentry.addBreadcrumb({
      category: 'http',
      message: `${method} ${url}`,
      level: 'info',
      data: {
        method,
        url,
        ip,
      },
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const { statusCode } = context.switchToHttp().getResponse();

        // Add breadcrumb for response
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${method} ${url} ${statusCode}`,
          level: statusCode >= 400 ? 'warning' : 'info',
          data: {
            method,
            url,
            statusCode,
            duration,
          },
        });

        // Log slow requests
        if (duration > 1000) {
          Sentry.captureMessage(`Slow request: ${method} ${url} took ${duration}ms`, {
            level: 'warning',
            tags: {
              slowRequest: 'true',
              duration: duration.toString(),
            },
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Add breadcrumb for error
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${method} ${url} failed`,
          level: 'error',
          data: {
            method,
            url,
            duration,
            error: error.message,
          },
        });

        throw error;
      }),
    );
  }
}

