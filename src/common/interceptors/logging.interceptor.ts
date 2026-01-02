import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import * as Sentry from '@sentry/node';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Log all requests, especially auth endpoints
    if (url?.includes('/auth/')) {
      const hasAuth = request.headers.authorization ? 'YES' : 'NO';
      const userAgent = request.headers['user-agent']?.substring(0, 50) || 'unknown';
      this.logger.log(
        `[${timestamp}] 📥 INCOMING REQUEST: ${method} ${url} from ${ip} - Auth header: ${hasAuth} - UserAgent: ${userAgent}`,
      );
    }

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
        interface ResponseWithStatusCode {
          statusCode?: number;
          [key: string]: unknown;
        }
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;
        const timestamp = new Date().toISOString();

        // Log auth endpoint responses
        if (url?.includes('/auth/')) {
          const statusEmoji = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️' : '✅';
          this.logger.log(
            `[${timestamp}] ${statusEmoji} RESPONSE: ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms`,
          );
        }

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
          Sentry.captureMessage(
            `Slow request: ${method} ${url} took ${duration}ms`,
            {
              level: 'warning',
              tags: {
                slowRequest: 'true',
                duration: duration.toString(),
              },
            },
          );
        }
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Add breadcrumb for error
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${method} ${url} failed`,
          level: 'error',
          data: {
            method,
            url,
            duration,
            error: errorMessage,
          },
        });

        throw error;
      }),
    );
  }
}
