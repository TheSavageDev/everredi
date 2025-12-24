import { Module } from '@nestjs/common';
import { UserCategoriesController } from './user-categories.controller';
import { UserCategoriesService } from './user-categories.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [UserCategoriesController],
  providers: [UserCategoriesService],
  exports: [UserCategoriesService],
})
export class UserCategoriesModule {}


