import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE } from '../../config/supabase.provider';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

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

    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      this.logger.warn(
        `[${timestamp}] ❌ SupabaseAuthGuard: No token provided for ${method} ${url} from ${ip}`,
      );
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7);

    try {
      // Verify the JWT token using Supabase

      const response = await this.supabase.auth.getUser(token);

      if (response.error) {
        const errorMessage = response.error.message || 'Invalid token';

        throw new Error(errorMessage);
      }

      if (!response.data?.user) {
        throw new Error('User not found in token');
      }

      const user: User = response.data.user;

      // Extract user ID from the JWT sub claim (Supabase uses 'sub' as the user ID)
      // For compatibility with existing code, we use 'uid' as the property name

      request.user = {
        uid: user.id, // Supabase user.id is the UUID

        email: user.email || undefined,
        // Include other user metadata if needed

        ...(user.user_metadata || {}),
      };

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `[${timestamp}] ❌ SupabaseAuthGuard: Invalid token for ${method} ${url} from ${ip} - ${errorMessage}`,
      );
      throw new UnauthorizedException('Invalid token');
    }
  }
}
