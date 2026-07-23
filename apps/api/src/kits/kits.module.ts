import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { KitsController } from './kits.controller';
import { KitsService } from './kits.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [KitsController],
  providers: [KitsService],
  exports: [KitsService],
})
export class KitsModule {}
