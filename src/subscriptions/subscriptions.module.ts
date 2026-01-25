import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { RevenueCatService } from './revenuecat.service';
import { UsersModule } from '../users/users.module';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [forwardRef(() => UsersModule), SupabaseModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, StripeService, RevenueCatService],
  exports: [SubscriptionsService, StripeService, RevenueCatService],
})
export class SubscriptionsModule {}
