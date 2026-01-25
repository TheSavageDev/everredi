import { Module } from '@nestjs/common';
import { ContainersService } from './containers.service';
import { SupabaseModule } from '../config/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [ContainersService],
  exports: [ContainersService],
})
export class ContainersModule {}
