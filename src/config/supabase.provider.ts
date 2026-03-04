import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, FactoryProvider } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE = 'SUPABASE';

@Injectable()
export class SupabaseApp {
  private client: SupabaseClient;
  private readonly logger = new Logger(SupabaseApp.name);

  constructor(private readonly config: ConfigService) {
    this.initialize();
  }

  private initialize(): void {
    try {
      const supabaseUrl = this.config.get<string>('SUPABASE_URL');
      const supabaseServiceRoleKey = this.config.get<string>(
        'SUPABASE_SECRET_KEY',
      );

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL must be set');
      }

      if (!supabaseServiceRoleKey) {
        throw new Error('SUPABASE_SECRET_KEY must be set');
      }

      // Create Supabase client with service role key for admin operations

      this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
      }) as SupabaseClient;

      this.logger.log(
        `✅ Supabase client initialized successfully for project: ${supabaseUrl}`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Supabase client:',
        error instanceof Error ? error.stack : String(error),
      );
      throw error; // Re-throw to prevent app from starting with broken Supabase
    }
  }

  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Supabase client not initialized. Check your environment variables.',
      );
    }
    return this.client;
  }
}

// Factory provider for token-based injection
export const supabaseProvider: FactoryProvider<SupabaseClient> = {
  provide: SUPABASE,
  useFactory: (supabaseApp: SupabaseApp): SupabaseClient => {
    return supabaseApp.getClient();
  },
  inject: [SupabaseApp],
};
