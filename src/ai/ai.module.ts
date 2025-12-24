import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { UsersModule } from '../users/users.module';
import { PremiumGuard } from '../common/guards/premium.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [UsersModule],
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: APP_GUARD,
      useClass: PremiumGuard,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
