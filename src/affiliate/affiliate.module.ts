import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller';
import { AffiliateTrackingService } from './affiliate-tracking.service';

@Module({
  controllers: [AffiliateController],
  providers: [AffiliateTrackingService],
  exports: [AffiliateTrackingService],
})
export class AffiliateModule {}
