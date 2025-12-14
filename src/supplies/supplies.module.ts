import { Module } from '@nestjs/common';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { firestoreProvider } from '../config/firebase.provider';

@Module({
  controllers: [SuppliesController],
  providers: [SuppliesService, firestoreProvider],
  exports: [SuppliesService],
})
export class SuppliesModule {}
