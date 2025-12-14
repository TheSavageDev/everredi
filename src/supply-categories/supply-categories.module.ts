import { Module } from '@nestjs/common';
import { SupplyCategoriesController } from './supply-categories.controller';
import { SupplyCategoriesService } from './supply-categories.service';
import { firestoreProvider } from '../config/firebase.provider';

@Module({
  controllers: [SupplyCategoriesController],
  providers: [SupplyCategoriesService, firestoreProvider],
  exports: [SupplyCategoriesService],
})
export class SupplyCategoriesModule {}
