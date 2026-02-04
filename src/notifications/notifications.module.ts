import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { ExpirationTasksController } from './expiration-tasks.controller';
import { AdvancedNotificationsController } from './advanced-notifications.controller';
import { BroadcastNotificationsController } from './broadcast-notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationGeneratorService } from './notification-generator.service';
import { CloudTasksService } from './cloud-tasks.service';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokensService } from './device-tokens.service';
import { ExpirationNotificationsService } from './expiration-notifications.service';
import { AdvancedNotificationsService } from './advanced-notifications.service';
import { ScheduledBroadcastsService } from './scheduled-broadcasts.service';
import { LowStockNotificationsService } from './low-stock-notifications.service';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [
    NotificationsController,
    ExpirationTasksController,
    AdvancedNotificationsController,
    BroadcastNotificationsController,
  ],
  providers: [
    NotificationsService,
    NotificationGeneratorService,
    CloudTasksService,
    PushNotificationService,
    DeviceTokensService,
    ExpirationNotificationsService,
    AdvancedNotificationsService,
    ScheduledBroadcastsService,
    LowStockNotificationsService,
  ],
  imports: [UsersModule],
  exports: [
    NotificationsService,
    NotificationGeneratorService,
    CloudTasksService,
    PushNotificationService,
    DeviceTokensService,
    ExpirationNotificationsService,
    AdvancedNotificationsService,
    ScheduledBroadcastsService,
    LowStockNotificationsService,
  ],
})
export class NotificationsModule {}
