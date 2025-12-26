import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Extract user context from request if available
    const user = (request as any).user;
    if (user) {
      Sentry.setUser({
        id: user.uid || user.id,
        email: user.email,
        username: user.name || user.displayName,
      });
    }

    // Set request context
    Sentry.setContext('request', {
      method: request.method,
      url: request.url,
      headers: {
        'user-agent': request.headers['user-agent'],
        'content-type': request.headers['content-type'],
      },
      query: request.query,
      body: this.sanitizeBody(request.body),
    });

    // Determine status code and message
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Capture exception in Sentry
    if (status >= 500) {
      // Only capture server errors (5xx)
      Sentry.captureException(exception, {
        tags: {
          httpStatus: status.toString(),
          httpMethod: request.method,
          route: request.url,
        },
        level: 'error',
      });
    } else if (status >= 400) {
      // Log client errors (4xx) as warnings
      Sentry.captureException(exception, {
        tags: {
          httpStatus: status.toString(),
          httpMethod: request.method,
          route: request.url,
        },
        level: 'warning',
      });
    }

    // Send response
    response.status(status).json({
      success: false,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'privateKey'];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[Filtered]';
      }
    });

    return sanitized;
  }
}

