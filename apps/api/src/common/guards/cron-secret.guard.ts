import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET is not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.header('authorization');
    if (auth !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Invalid cron secret');
    }
    return true;
  }
}
