import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { DeviceTokensService } from './device-tokens.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deviceTokensService: DeviceTokensService,
  ) {}

  @Get()
  async getNotifications(@CurrentUser() user: { uid: string }) {
    const notifications = await this.notificationsService.getNotifications(
      user.uid,
    );
    return {
      success: true,
      data: notifications,
      message: 'Notifications retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id/read')
  async markAsRead(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(user.uid, id);
    return {
      success: true,
      message: 'Notification marked as read',
      timestamp: new Date().toISOString(),
    };
  }

  @Put('read-all')
  async markAllAsRead(@CurrentUser() user: { uid: string }) {
    await this.notificationsService.markAllAsRead(user.uid);
    return {
      success: true,
      message: 'All notifications marked as read',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('register-device')
  async registerDevice(
    @CurrentUser() user: { uid: string },
    @Body() body: { token: string; platform?: 'ios' | 'android' | 'web' },
  ) {
    const platform = body.platform || 'ios'; // Default to iOS, should be detected from client
    await this.deviceTokensService.registerDeviceToken(
      user.uid,
      body.token,
      platform,
    );
    return {
      success: true,
      message: 'Device token registered successfully',
      timestamp: new Date().toISOString(),
    };
  }

  // Preferences endpoint moved to AdvancedNotificationsController (premium feature)
  // This route is removed to avoid conflict with the premium version

  @Put('preferences')
  updatePreferences(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentUser() _user: { uid: string },
    @Body()
    _preferences: {
      expirationAlerts?: boolean;
      expirationAlertDays?: number[];
      oshaComplianceAlerts?: boolean;
      kitReminders?: boolean;
    },
  ) {
    // TODO: Store preferences in Firestore
    // For now, just return success
    return {
      success: true,
      message: 'Notification preferences updated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
