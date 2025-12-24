import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { uid?: string } | undefined;

    if (!user?.uid) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
      });
    }

    const isAdmin = await this.usersService.isAdminUser(user.uid);

    if (!isAdmin) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Admin access required.',
      });
    }

    return true;
  }
}
