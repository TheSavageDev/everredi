import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger = new (class {
    log(message: any, ...optionalParams: any[]) {
      console.log(message, ...optionalParams);
    }
    error(message: any, ...optionalParams: any[]) {
      console.error(message, ...optionalParams);
    }
    warn(message: any, ...optionalParams: any[]) {
      console.warn(message, ...optionalParams);
    }
    debug(message: any, ...optionalParams: any[]) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(message, ...optionalParams);
      }
    }
    verbose(message: any, ...optionalParams: any[]) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(message, ...optionalParams);
      }
    }
  })();

  log(message: any, ...optionalParams: any[]) {
    this.logger.log(message, ...optionalParams);
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, trace, context);

    // Send errors to Sentry
    if (message instanceof Error) {
      Sentry.captureException(message, {
        tags: {
          context: context || 'unknown',
        },
      });
    } else {
      Sentry.captureMessage(
        typeof message === 'string' ? message : JSON.stringify(message),
        {
          level: 'error',
          tags: {
            context: context || 'unknown',
          },
        },
      );
    }
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, context);

    // Send warnings to Sentry
    Sentry.captureMessage(
      typeof message === 'string' ? message : JSON.stringify(message),
      {
        level: 'warning',
        tags: {
          context: context || 'unknown',
        },
      },
    );
  }

  debug(message: any, ...optionalParams: any[]) {
    this.logger.debug(message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.logger.verbose(message, ...optionalParams);
  }
}

