import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { FirebaseModule } from './config/firebase.module';
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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    FirebaseModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
