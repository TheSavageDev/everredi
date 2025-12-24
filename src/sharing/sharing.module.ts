import { Module } from '@nestjs/common';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import { KitsModule } from '../kits/kits.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [KitsModule, UsersModule],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
