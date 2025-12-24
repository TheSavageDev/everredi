import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { firestoreProvider } from '../config/firebase.provider';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [NotificationsModule, UsersModule],
  controllers: [InventoryController],
  providers: [InventoryService, firestoreProvider],
  exports: [InventoryService],
})
export class InventoryModule {}
