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
    const request = context.switchToHttp().getRequest();
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['authorization']?.replace('Bearer ', '');

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


