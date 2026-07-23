import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [UsersModule, WorkspacesModule],
  controllers: [AuthController],
})
export class AuthModule {}
