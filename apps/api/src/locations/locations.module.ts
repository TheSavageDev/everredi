import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
