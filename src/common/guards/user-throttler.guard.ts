import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
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

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestWithUser): Promise<string> {
    // Use user UID if available (from Firebase Auth or API Key)
    if (req.user?.uid) {
      return `user:${req.user.uid}`;
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
    return `ip:${ip}`;
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

    const response = context.switchToHttp().getResponse();

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
