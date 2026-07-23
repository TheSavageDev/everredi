import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const user = await this.verify(token);
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async verify(token: string): Promise<AuthUser> {
    const jwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');

    if (jwtSecret) {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(jwtSecret),
        { algorithms: ['HS256'] },
      );
      const sub = payload.sub;
      const email = typeof payload.email === 'string' ? payload.email : null;
      if (!sub || !email) {
        throw new UnauthorizedException('Invalid token claims');
      }
      return { id: sub, email };
    }

    if (!supabaseUrl) {
      throw new UnauthorizedException('Auth is not configured');
    }
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(
        new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
      );
    }
    const { payload } = await jwtVerify(token, this.jwks);
    const sub = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : null;
    if (!sub || !email) {
      throw new UnauthorizedException('Invalid token claims');
    }
    return { id: sub, email };
  }
}
