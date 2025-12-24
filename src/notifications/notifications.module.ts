import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { ExpirationTasksController } from './expiration-tasks.controller';
import { AdvancedNotificationsController } from './advanced-notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationGeneratorService } from './notification-generator.service';
import { CloudTasksService } from './cloud-tasks.service';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokensService } from './device-tokens.service';
import { ExpirationNotificationsService } from './expiration-notifications.service';
import { AdvancedNotificationsService } from './advanced-notifications.service';
import { firestoreProvider } from '../config/firebase.provider';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [
    NotificationsController,
    ExpirationTasksController,
    AdvancedNotificationsController,
  ],
  providers: [
    NotificationsService,
    NotificationGeneratorService,
    CloudTasksService,
    PushNotificationService,
    DeviceTokensService,
    ExpirationNotificationsService,
    AdvancedNotificationsService,
    firestoreProvider,
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
  ],
})
export class NotificationsModule {}
