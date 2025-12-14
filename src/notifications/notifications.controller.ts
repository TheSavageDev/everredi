import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { DeviceTokensService } from './device-tokens.service';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deviceTokensService: DeviceTokensService,
  ) {}

  @Get()
  async getNotifications(@CurrentUser() user: any) {
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
  async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    await this.notificationsService.markAsRead(user.uid, id);
    return {
      success: true,
      message: 'Notification marked as read',
      timestamp: new Date().toISOString(),
    };
  }

  @Put('read-all')
  async markAllAsRead(@CurrentUser() user: any) {
    await this.notificationsService.markAllAsRead(user.uid);
    return {
      success: true,
      message: 'All notifications marked as read',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('register-device')
  async registerDevice(
    @CurrentUser() user: any,
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

  @Get('preferences')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPreferences(@CurrentUser() _user: any) {
    // TODO: Implement preferences storage in Firestore
    // For now, return defaults
    return {
      success: true,
      data: {
        expirationAlerts: true,
        expirationAlertDays: [60, 30, 10, 1],
        oshaComplianceAlerts: true,
        kitReminders: false,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('preferences')
  async updatePreferences(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentUser() _user: any,
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
