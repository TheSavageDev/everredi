import { Module } from '@nestjs/common';
import { CronSecretGuard } from '../common/guards/cron-secret.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AlertsController],
  providers: [AlertsService, CronSecretGuard],
  exports: [AlertsService],
})
export class AlertsModule {}
