import { Module } from '@nestjs/common';
import { BulkOperationsController } from './bulk-operations.controller';
import { BulkOperationsService } from './bulk-operations.service';
import { UsersModule } from '../users/users.module';
import { InventoryModule } from '../inventory/inventory.module';
import { KitsModule } from '../kits/kits.module';

@Module({
  imports: [UsersModule, InventoryModule, KitsModule],
  controllers: [BulkOperationsController],
  providers: [BulkOperationsService],
  exports: [BulkOperationsService],
})
export class BulkOperationsModule {}


