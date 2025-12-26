import {
  Injectable,
  LoggerService as NestLoggerService,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable()
export class LoggerService implements NestLoggerService {
  private nestLogger: Logger;
  private contextName: string;

  constructor(context?: string) {
    this.contextName = context || LoggerService.name;
    this.nestLogger = new Logger(this.contextName);
  }

  /**
   * Set the context for this logger instance
   * Note: NestJS Logger doesn't have setContext, so we create a new instance
   */
  setContext(context: string) {
    this.contextName = context;
    // Create a new Logger instance with the new context
    this.nestLogger = new Logger(context);
  }

  log(message: any, context?: string) {
    const logMessage =
      typeof message === 'string' ? message : JSON.stringify(message);
    const logContext = context || this.contextName;

    // Use NestJS logger for console output
    this.nestLogger.log(message, context);

    // Send to Sentry logger
    if (Sentry.logger) {
      Sentry.logger.info(logMessage, { context: logContext });
    }
  }

  error(message: any, trace?: string, context?: string) {
    const logContext = context || this.contextName;

    // Use NestJS logger for console output
    this.nestLogger.error(message, trace, context);

    // Send errors to Sentry
    if (message instanceof Error) {
      Sentry.captureException(message, {
        tags: {
          context: logContext,
        },
      });
      // Also log to Sentry logger if available
      if (Sentry.logger) {
        Sentry.logger.error(message.message, {
          context: logContext,
          error: message,
          stack: message.stack,
        });
      }
    } else {
      const errorMessage =
        typeof message === 'string' ? message : JSON.stringify(message);
      Sentry.captureMessage(errorMessage, {
        level: 'error',
        tags: {
          context: logContext,
        },
      });
      // Also log to Sentry logger if available
      if (Sentry.logger) {
        Sentry.logger.error(errorMessage, {
          context: logContext,
          trace,
        });
      }
    }
  }

  warn(message: any, context?: string) {
    const logMessage =
      typeof message === 'string' ? message : JSON.stringify(message);
    const logContext = context || this.contextName;

    // Use NestJS logger for console output
    this.nestLogger.warn(message, context);

    // Send warnings to Sentry
    Sentry.captureMessage(logMessage, {
      level: 'warning',
      tags: {
        context: logContext,
      },
    });

    // Also log to Sentry logger if available
    if (Sentry.logger) {
      Sentry.logger.warn(logMessage, { context: logContext });
    }
  }

  debug(message: any, context?: string) {
    const logMessage =
      typeof message === 'string' ? message : JSON.stringify(message);
    const logContext = context || this.contextName;

    // Use NestJS logger for console output
    this.nestLogger.debug(message, context);

    // Send to Sentry logger (debug level) if available
    if (Sentry.logger) {
      Sentry.logger.debug(logMessage, { context: logContext });
    }
  }

  verbose(message: any, context?: string) {
    const logMessage =
      typeof message === 'string' ? message : JSON.stringify(message);
    const logContext = context || this.contextName;

    // Use NestJS logger for console output
    this.nestLogger.verbose(message, context);

    // Send to Sentry logger (trace level for verbose) if available
    if (Sentry.logger) {
      Sentry.logger.trace(logMessage, { context: logContext });
    }
  }
}
