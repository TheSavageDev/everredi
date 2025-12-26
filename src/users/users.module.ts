import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  firestoreProvider,
  firebaseAuthProvider,
} from '../config/firebase.provider';

@Module({
  controllers: [UsersController],
  providers: [UsersService, firestoreProvider, firebaseAuthProvider],
  exports: [UsersService],
})
export class UsersModule {}
