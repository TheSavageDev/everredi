import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { FirebaseModule } from '../config/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [AffiliateController],
  providers: [AffiliateTrackingService],
  exports: [AffiliateTrackingService],
})
export class AffiliateModule {}
