import { Module } from '@nestjs/common';
import { BrandPartnershipsController } from './brand-partnerships.controller';
import { BrandPartnershipsService } from './brand-partnerships.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [BrandPartnershipsController],
  providers: [BrandPartnershipsService],
  exports: [BrandPartnershipsService],
})
export class BrandPartnershipsModule {}
