import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { InventoryModule } from './inventory/inventory.module';
import { KitsModule } from './kits/kits.module';
import { LocationsModule } from './locations/locations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SharingModule } from './sharing/sharing.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SuppliesModule } from './supplies/supplies.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DbModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    LocationsModule,
    SuppliesModule,
    KitsModule,
    InventoryModule,
    SharingModule,
    NotificationsModule,
    SubscriptionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
