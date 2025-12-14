import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { firestoreProvider } from '../config/firebase.provider';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [InventoryController],
  providers: [InventoryService, firestoreProvider],
  exports: [InventoryService],
})
export class InventoryModule {}
