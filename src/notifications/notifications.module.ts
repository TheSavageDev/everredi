import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { ExpirationTasksController } from './expiration-tasks.controller';
import { NotificationsService } from './notifications.service';
import { NotificationGeneratorService } from './notification-generator.service';
import { CloudTasksService } from './cloud-tasks.service';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokensService } from './device-tokens.service';
import { ExpirationNotificationsService } from './expiration-notifications.service';
import { firestoreProvider } from '../config/firebase.provider';

@Module({
  controllers: [NotificationsController, ExpirationTasksController],
  providers: [
    NotificationsService,
    NotificationGeneratorService,
    CloudTasksService,
    PushNotificationService,
    DeviceTokensService,
    ExpirationNotificationsService,
    firestoreProvider,
  ],
  exports: [
    NotificationsService,
    NotificationGeneratorService,
    CloudTasksService,
    PushNotificationService,
    DeviceTokensService,
    ExpirationNotificationsService,
  ],
})
export class NotificationsModule {}
