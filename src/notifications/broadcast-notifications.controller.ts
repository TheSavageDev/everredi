import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PushNotificationService } from './push-notification.service';
import { ScheduledBroadcastsService } from './scheduled-broadcasts.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class BroadcastNotificationsController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
    private readonly scheduledBroadcastsService: ScheduledBroadcastsService,
  ) {}

  /**
   * Send an immediate broadcast push to all users with notifications enabled.
   * Admin only.
   */
  @Post('broadcast')
  async sendBroadcast(
    @Body()
    body: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    const { title, body: messageBody, data } = body;
    if (!title || !messageBody) {
      return {
        success: false,
        message: 'title and body are required',
        timestamp: new Date().toISOString(),
      };
    }

    const result = await this.pushNotificationService.sendBroadcast(
      title,
      messageBody,
      data,
    );

    return {
      success: true,
      data: {
        userCount: result.userCount,
        messageCount: result.messageCount,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
      message: 'Broadcast sent successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a scheduled broadcast. Admin only.
   */
  @Post('broadcast/scheduled')
  async createScheduled(
    @Body()
    body: {
      title: string;
      body: string;
      scheduledAt: string; // ISO date string
      data?: Record<string, string>;
    },
  ) {
    const { title, body: messageBody, scheduledAt, data } = body;
    if (!title || !messageBody || !scheduledAt) {
      return {
        success: false,
        message: 'title, body, and scheduledAt are required',
        timestamp: new Date().toISOString(),
      };
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return {
        success: false,
        message: 'scheduledAt must be a valid ISO date string',
        timestamp: new Date().toISOString(),
      };
    }

    const broadcast = await this.scheduledBroadcastsService.create(
      title,
      messageBody,
      scheduledDate,
      data,
    );

    return {
      success: true,
      data: {
        id: broadcast.id,
        title: broadcast.title,
        body: broadcast.body,
        data: broadcast.data,
        scheduledAt: broadcast.scheduledAt.toISOString(),
        status: broadcast.status,
        createdAt: broadcast.createdAt.toISOString(),
      },
      message: 'Scheduled broadcast created',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * List scheduled broadcasts. Admin only. Optional ?status=pending|sent|cancelled
   */
  @Get('broadcast/scheduled')
  async listScheduled(
    @Query('status') status?: 'pending' | 'sent' | 'cancelled',
  ) {
    const list = await this.scheduledBroadcastsService.list(status);
    return {
      success: true,
      data: list.map((b) => ({
        id: b.id,
        title: b.title,
        body: b.body,
        data: b.data,
        scheduledAt: b.scheduledAt.toISOString(),
        status: b.status,
        sentAt: b.sentAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cancel a pending scheduled broadcast. Admin only.
   */
  @Patch('broadcast/scheduled/:id/cancel')
  async cancelScheduled(@Param('id') id: string) {
    const broadcast = await this.scheduledBroadcastsService.cancel(id);
    return {
      success: true,
      data: {
        id: broadcast.id,
        status: broadcast.status,
      },
      message: 'Scheduled broadcast cancelled',
      timestamp: new Date().toISOString(),
    };
  }
}
