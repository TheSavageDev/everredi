import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { firestoreProvider } from '../config/firebase.provider';

@Module({
  controllers: [UsersController],
  providers: [UsersService, firestoreProvider],
  exports: [UsersService],
})
export class UsersModule {}
