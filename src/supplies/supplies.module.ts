import { Module } from '@nestjs/common';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { UsersModule } from '../users/users.module';
import { firestoreProvider } from '../config/firebase.provider';

@Module({
  imports: [UsersModule],
  controllers: [SuppliesController],
  providers: [SuppliesService, firestoreProvider],
  exports: [SuppliesService],
})
export class SuppliesModule {}
