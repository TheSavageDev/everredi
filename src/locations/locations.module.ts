import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { firestoreProvider } from '../config/firebase.provider';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, firestoreProvider],
  exports: [LocationsService],
})
export class LocationsModule {}
