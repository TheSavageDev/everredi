import { Module } from '@nestjs/common';
import { SupplyCategoriesController } from './supply-categories.controller';
import { SupplyCategoriesService } from './supply-categories.service';

@Module({
  controllers: [SupplyCategoriesController],
  providers: [SupplyCategoriesService],
  exports: [SupplyCategoriesService],
})
export class SupplyCategoriesModule {}
