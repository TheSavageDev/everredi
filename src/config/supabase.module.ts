import { Module, Global } from '@nestjs/common';
import { ConfigModule } from './config.module';
import { SupabaseApp, supabaseProvider, SUPABASE } from './supabase.provider';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseApp, supabaseProvider, SupabaseService],
  exports: [SupabaseApp, SUPABASE, SupabaseService],
})
export class SupabaseModule {}
