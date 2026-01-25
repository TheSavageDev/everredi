import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService],
  imports: [UsersModule],
  exports: [LocationsService],
})
export class LocationsModule {}
