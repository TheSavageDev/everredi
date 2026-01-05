import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  firestoreProvider,
  firebaseAuthProvider,
} from '../config/firebase.provider';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [forwardRef(() => SubscriptionsModule)],
  controllers: [UsersController],
  providers: [UsersService, firestoreProvider, firebaseAuthProvider],
  exports: [UsersService],
})
export class UsersModule {}
