import * as Sentry from '@sentry/node';
import { ConfigService } from '@nestjs/config';

export function initializeSentry(configService: ConfigService): void {
  const dsn = configService.get<string>('SENTRY_DSN');
  const environment =
    configService.get<string>('SENTRY_ENVIRONMENT') ||
    configService.get<string>('NODE_ENV') ||
    'development';
  const release = configService.get<string>('SENTRY_RELEASE');
  const tracesSampleRate = parseFloat(
    configService.get<string>('SENTRY_TRACES_SAMPLE_RATE') || '0.1',
  );

  // Only initialize if DSN is provided
  if (!dsn) {
    // Use console.warn here since logger might not be available yet during initialization
    console.warn(
      '⚠️  Sentry DSN not configured. Error tracking will be disabled.',
    );
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      release,
      tracesSampleRate,
      enableLogs: environment === 'development',
      // HTTP instrumentation is enabled by default in Sentry v8 when tracesSampleRate is set
      // Note: consoleLoggingIntegration can be added if needed, but we're using NestJS Logger with Sentry.logger instead
      // HTTP instrumentation is enabled by default in Sentry v8 when tracesSampleRate is set
      // Filter out sensitive data
      beforeSend(event) {
        // Remove sensitive data from event
        if (event.request) {
          // Remove authorization headers
          if (event.request.headers) {
            const headers = { ...event.request.headers };
            delete headers['authorization'];
            delete headers['Authorization'];
            delete headers['cookie'];
            delete headers['Cookie'];
            event.request.headers = headers;
          }

          // Remove sensitive query parameters
          if (event.request.query_string) {
            const queryString = event.request.query_string;
            // query_string can be a string or array of [key, value] tuples
            if (typeof queryString === 'string') {
              // Remove common sensitive params
              const sensitiveParams = [
                'token',
                'api_key',
                'password',
                'secret',
              ];
              if (
                sensitiveParams.some((param) => queryString.includes(param))
              ) {
                event.request.query_string = '[Filtered]';
              }
            }
          }
        }

        // Remove sensitive data from extra context
        if (event.extra) {
          const extra = { ...event.extra };
          delete extra.password;
          delete extra.token;
          delete extra.apiKey;
          delete extra.secret;
          event.extra = extra;
        }

        return event;
      },
    });

    // Use console.log here since logger might not be available yet during initialization
    console.log(
      `✅ Sentry initialized for environment: ${environment}${release ? ` (release: ${release})` : ''}`,
    );
  } catch (error) {
    // Use console.error here since logger might not be available yet during initialization
    console.error('❌ Failed to initialize Sentry:', error);
    console.warn('   Continuing without Sentry...');
  }
}
