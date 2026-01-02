import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import type { auth } from 'firebase-admin';
import { FIREBASE_AUTH } from '../../config/firebase.provider';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: auth.Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    interface RequestWithUser {
      headers: {
        authorization?: string;
        [key: string]: unknown;
      };
      user?: {
        uid: string;
        email?: string;
        [key: string]: unknown;
      };
      method?: string;
      url?: string;
      ip?: string;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;
    const timestamp = new Date().toISOString();
    const method = request.method || 'UNKNOWN';
    const url = request.url || 'UNKNOWN';
    const ip = request.ip || 'unknown';

    this.logger.debug(
      `[${timestamp}] 🔒 FirebaseAuthGuard: ${method} ${url} from ${ip}`,
    );

    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      this.logger.warn(
        `[${timestamp}] ❌ FirebaseAuthGuard: No token provided for ${method} ${url} from ${ip}`,
      );
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7);
    const tokenPreview = token.substring(0, 20) + '...';

    try {
      this.logger.debug(
        `[${timestamp}] 🔑 FirebaseAuthGuard: Verifying token ${tokenPreview} for ${method} ${url}`,
      );
      const decodedToken = await this.firebaseAuth.verifyIdToken(token);
      request.user = {
        ...decodedToken,
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
      this.logger.debug(
        `[${timestamp}] ✅ FirebaseAuthGuard: Token verified for user=${decodedToken.uid}, email=${decodedToken.email || 'no-email'}`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `[${timestamp}] ❌ FirebaseAuthGuard: Invalid token for ${method} ${url} from ${ip} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new UnauthorizedException('Invalid token');
    }
  }
}
