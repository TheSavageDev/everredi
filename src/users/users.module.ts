import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from './users.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [forwardRef(() => SubscriptionsModule)],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
