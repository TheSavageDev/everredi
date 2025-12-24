import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService],
  imports: [UsersModule],
  exports: [ComplianceService],
})
export class ComplianceModule {}
