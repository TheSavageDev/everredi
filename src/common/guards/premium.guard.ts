import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PREMIUM_KEY } from '../decorators/premium.decorator';
import { UsersService } from '../../users/users.service';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPremiumRoute = this.reflector.getAllAndOverride<boolean>(
      PREMIUM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isPremiumRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { uid?: string } | undefined;

    if (!user?.uid) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
      });
    }

    const subscription = await this.usersService.getSubscriptionStatus(
      user.uid,
    );

    if (!subscription.isPremium) {
      throw new ForbiddenException({
        code: 'PREMIUM_REQUIRED',
        message: 'Premium subscription required.',
      });
    }

    return true;
  }
}



