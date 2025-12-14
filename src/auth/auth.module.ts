import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { firebaseAuthProvider } from '../config/firebase.provider';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, firebaseAuthProvider],
  exports: [AuthService],
})
export class AuthModule {}
