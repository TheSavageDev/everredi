import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportContactController } from './support-contact.controller';
import { SupportService } from './support.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [SupportController, SupportContactController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
