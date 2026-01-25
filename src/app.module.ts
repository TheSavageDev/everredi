import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { SupabaseModule } from './config/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { SupplyCategoriesModule } from './supply-categories/supply-categories.module';
import { SuppliesModule } from './supplies/supplies.module';
import { InventoryModule } from './inventory/inventory.module';
import { KitsModule } from './kits/kits.module';
import { AiModule } from './ai/ai.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ComplianceModule } from './compliance/compliance.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BulkOperationsModule } from './bulk/bulk-operations.module';
import { UserCategoriesModule } from './categories/user-categories.module';
import { TeamsModule } from './teams/teams.module';
import { SharingModule } from './sharing/sharing.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SupportModule } from './support/support.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { BrandPartnershipsModule } from './brands/brand-partnerships.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const isDevelopment = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Rate limiting: Disabled in development, 1000 requests per hour per user in production
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 3600000, // 1 hour in milliseconds (3600 * 1000)
        limit: isDevelopment ? 1000000 : 1000, // Very high limit in dev, 1000 in prod
      },
      {
        name: 'short',
        ttl: 60000, // 1 minute in milliseconds (60 * 1000)
        limit: 100, // 100 requests per minute
      },
      {
        name: 'medium',
        ttl: 3600000, // 1 hour in milliseconds (3600 * 1000)
        limit: 1000, // 1000 requests per hour
      },
      {
        name: 'long',
        ttl: 86400000, // 1 day in milliseconds (24 * 60 * 60 * 1000)
        limit: 10000, // 10000 requests per day
      },
    ]),
    ConfigModule,
    SupabaseModule,
    AuthModule,
    UsersModule,
    LocationsModule,
    SupplyCategoriesModule,
    SuppliesModule,
    InventoryModule,
    KitsModule,
    AiModule,
    SubscriptionsModule,
    NotificationsModule,
    ComplianceModule,
    AffiliateModule,
    AnalyticsModule,
    BulkOperationsModule,
    UserCategoriesModule,
    TeamsModule,
    SharingModule,
    ApiKeysModule,
    SupportModule,
    CustomFieldsModule,
    BrandPartnershipsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
