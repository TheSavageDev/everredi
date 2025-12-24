import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { RevenueCatService } from './revenuecat.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, StripeService, RevenueCatService],
  exports: [SubscriptionsService, StripeService],
})
export class SubscriptionsModule {}
