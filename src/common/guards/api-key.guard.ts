import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    interface RequestWithUser {
      headers: {
        'x-api-key'?: string;
        authorization?: string;
        [key: string]: unknown;
      };
      user?: {
        uid: string;
        apiKeyId: string;
        [key: string]: unknown;
      };
    }

    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];
    const authHeader = request.headers.authorization;

    const apiKey =
      (typeof apiKeyHeader === 'string' ? apiKeyHeader : undefined) ||
      (typeof authHeader === 'string'
        ? authHeader.replace('Bearer ', '')
        : undefined);

    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    const validation = await this.apiKeysService.validateApiKey(apiKey);
    if (!validation) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Attach user info to request
    request.user = { uid: validation.userId, apiKeyId: validation.keyId };
    return true;
  }
}
