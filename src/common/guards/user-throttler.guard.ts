import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

interface RequestWithUser {
  user?: {
    uid?: string;
    [key: string]: unknown;
  };
  ip?: string;
  headers: {
    'x-forwarded-for'?: string;
    [key: string]: unknown;
  };
  connection?: {
    remoteAddress?: string;
    [key: string]: unknown;
  };
}

const isDevelopment = process.env.NODE_ENV !== 'production';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(UserThrottlerGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip throttling entirely in development
    if (isDevelopment) {
      return true;
    }
    return super.canActivate(context);
  }

  protected async getTracker(req: RequestWithUser): Promise<string> {
    // Use user UID if available (from Firebase Auth or API Key)
    if (req.user?.uid) {
      const tracker = `user:${req.user.uid}`;
      this.logger.debug(
        `[${new Date().toISOString()}] 📊 Rate limit tracker: ${tracker} (user-based)`,
      );
      return tracker;
    }

    // Fallback to IP address for unauthenticated requests
    // This provides basic protection for public endpoints
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : undefined;

    const ip =
      req.ip || forwardedIp || req.connection?.remoteAddress || 'unknown';
    const tracker = `ip:${ip}`;
    this.logger.debug(
      `[${new Date().toISOString()}] 📊 Rate limit tracker: ${tracker} (IP-based)`,
    );
    return tracker;
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    return `${name}:${suffix}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    interface ResponseWithHeaders {
      setHeader: (name: string, value: string | number) => void;
      [key: string]: unknown;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse();
    const timestamp = new Date().toISOString();
    const method = (request as { method?: string }).method || 'UNKNOWN';
    const url = (request as { url?: string }).url || 'UNKNOWN';
    const userInfo = request.user?.uid
      ? `user=${request.user.uid}`
      : `ip=${request.ip || 'unknown'}`;

    this.logger.warn(
      `[${timestamp}] 🚫 RATE LIMIT EXCEEDED: ${method} ${url} - ${userInfo} - Limit: ${throttlerLimitDetail.limit}/${Math.ceil(throttlerLimitDetail.ttl / 1000 / 60)}min, Hits: ${throttlerLimitDetail.totalHits}, Retry after: ${Math.ceil(throttlerLimitDetail.timeToExpire / 1000)}s`,
    );

    // Return proper 429 status with rate limit headers
    response.setHeader(
      'Retry-After',
      Math.ceil(throttlerLimitDetail.timeToExpire / 1000),
    );
    response.setHeader('X-RateLimit-Limit', throttlerLimitDetail.limit);
    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, throttlerLimitDetail.limit - throttlerLimitDetail.totalHits),
    );
    response.setHeader(
      'X-RateLimit-Reset',
      new Date(Date.now() + throttlerLimitDetail.timeToExpire).toISOString(),
    );

    throw new HttpException(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Maximum ${throttlerLimitDetail.limit} requests per ${Math.ceil(throttlerLimitDetail.ttl / 1000 / 60)} minutes. Please try again in ${Math.ceil(throttlerLimitDetail.timeToExpire / 1000)} seconds.`,
          retryAfter: Math.ceil(throttlerLimitDetail.timeToExpire / 1000),
        },
        timestamp: new Date().toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
