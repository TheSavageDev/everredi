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

    interface RequestWithUser extends Request {
      user?: {
        uid?: string;
        id?: string;
        email?: string;
        name?: string;
        displayName?: string;
        [key: string]: unknown;
      };
    }

    // Extract user context from request if available
    const user = (request as RequestWithUser).user;
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
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as {
          message?: string | string[];
          code?: string | number;
        };

        const rawMessage = responseObj.message;
        if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else if (Array.isArray(rawMessage)) {
          message = rawMessage.join(', ');
        } else {
          message = exception.message;
        }

        const rawCode = responseObj.code;
        if (typeof rawCode === 'string' || typeof rawCode === 'number') {
          code = String(rawCode);
        } else {
          code = undefined;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Capture exception in Sentry
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Only capture server errors (5xx)
      Sentry.captureException(exception, {
        tags: {
          httpStatus: status.toString(),
          httpMethod: request.method,
          route: request.url,
        },
        level: 'error',
      });
    } else if (status >= HttpStatus.BAD_REQUEST) {
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
    const responseBody: {
      success: false;
      message: string;
      statusCode: number;
      timestamp: string;
      path: string;
      code?: string;
    } = {
      success: false,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (code) {
      responseBody.code = code;
    }

    response.status(status).json(responseBody);
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object' || body === null) {
      return body;
    }

    const sanitized = { ...body } as Record<string, unknown>;
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'privateKey',
    ];

    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = '[Filtered]';
      }
    });

    return sanitized;
  }
}
