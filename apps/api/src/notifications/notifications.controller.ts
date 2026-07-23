import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return ok(await this.notifications.list(user.id));
  }

  @Post(':id/read')
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return ok(await this.notifications.markRead(user.id, id));
  }
}
