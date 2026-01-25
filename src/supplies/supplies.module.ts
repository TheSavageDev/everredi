import { Module } from '@nestjs/common';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { UsersModule } from '../users/users.module';
import { SupplyCategoriesModule } from '../supply-categories/supply-categories.module';

@Module({
  imports: [UsersModule, SupplyCategoriesModule],
  controllers: [SuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}
