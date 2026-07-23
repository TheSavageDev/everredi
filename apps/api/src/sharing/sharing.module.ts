import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [SharingController],
  providers: [SharingService],
})
export class SharingModule {}
