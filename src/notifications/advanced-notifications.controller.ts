import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { Premium } from '../common/decorators/premium.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  AdvancedNotificationsService,
  AlertThreshold,
  LowStockAlert,
} from './advanced-notifications.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard, PremiumGuard)
export class AdvancedNotificationsController {
  constructor(
    private readonly advancedNotificationsService: AdvancedNotificationsService,
  ) {}

  @Get('preferences')
  @Premium()
  async getPreferences(@CurrentUser('uid') userId: string) {
    const preferences =
      await this.advancedNotificationsService.getNotificationPreferences(
        userId,
      );
    return {
      success: true,
      data: preferences,
      message: 'Notification preferences retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser('uid') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const preferences =
      await this.advancedNotificationsService.updateNotificationPreferences(
        userId,
        body,
      );
    return {
      success: true,
      data: preferences,
      message: 'Notification preferences updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alert-thresholds')
  async getAlertThresholds(@CurrentUser('uid') userId: string) {
    const thresholds =
      await this.advancedNotificationsService.getAlertThresholds(userId);
    return {
      success: true,
      data: thresholds,
      message: 'Alert thresholds retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('alert-thresholds')
  async createAlertThreshold(
    @CurrentUser('uid') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const threshold =
      await this.advancedNotificationsService.createAlertThreshold(
        userId,
        body as Omit<
          AlertThreshold,
          'id' | 'userId' | 'createdAt' | 'updatedAt'
        >,
      );
    return {
      success: true,
      data: threshold,
      message: 'Alert threshold created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('alert-thresholds/:id')
  async updateAlertThreshold(
    @CurrentUser('uid') userId: string,
    @Param('id') thresholdId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const threshold =
      await this.advancedNotificationsService.updateAlertThreshold(
        userId,
        thresholdId,
        body,
      );
    return {
      success: true,
      data: threshold,
      message: 'Alert threshold updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('alert-thresholds/:id')
  async deleteAlertThreshold(
    @CurrentUser('uid') userId: string,
    @Param('id') thresholdId: string,
  ) {
    await this.advancedNotificationsService.deleteAlertThreshold(
      userId,
      thresholdId,
    );
    return {
      success: true,
      message: 'Alert threshold deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('low-stock-alerts')
  async getLowStockAlerts(@CurrentUser('uid') userId: string) {
    const alerts =
      await this.advancedNotificationsService.getLowStockAlerts(userId);
    return {
      success: true,
      data: alerts,
      message: 'Low stock alerts retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('low-stock-alerts')
  async createLowStockAlert(
    @CurrentUser('uid') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const alert = await this.advancedNotificationsService.createLowStockAlert(
      userId,
      body as Omit<LowStockAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    );
    return {
      success: true,
      data: alert,
      message: 'Low stock alert created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('low-stock-alerts/:id')
  async updateLowStockAlert(
    @CurrentUser('uid') userId: string,
    @Param('id') alertId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const alert = await this.advancedNotificationsService.updateLowStockAlert(
      userId,
      alertId,
      body,
    );
    return {
      success: true,
      data: alert,
      message: 'Low stock alert updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('low-stock-alerts/:id')
  async deleteLowStockAlert(
    @CurrentUser('uid') userId: string,
    @Param('id') alertId: string,
  ) {
    await this.advancedNotificationsService.deleteLowStockAlert(
      userId,
      alertId,
    );
    return {
      success: true,
      message: 'Low stock alert deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
