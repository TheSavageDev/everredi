import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

@Injectable()
export class EnvValidationService {
  constructor(private readonly configService: ConfigService) {}

  validate(): EnvValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    const nodeEnv =
      this.configService.get<string>('NODE_ENV') ||
      process.env.NODE_ENV ||
      'development';
    const isProduction = nodeEnv === 'production';

    // Required environment variables
    const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'];

    // In production, additional integrations are required
    if (isProduction) {
      required.push(
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'REVENUECAT_SECRET_API_KEY',
        'REVENUECAT_WEBHOOK_SECRET',
        'RESEND_API_KEY',
      );
    }

    // Check required vars
    for (const key of required) {
      const value = this.configService.get<string>(key);
      if (!value) {
        missing.push(key);
      }
    }

    // Optional but recommended
    const recommended = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'GEMINI_API_KEY',
      'RESEND_API_KEY',
    ];

    for (const key of recommended) {
      const value = this.configService.get<string>(key);
      if (!value) {
        warnings.push(
          `${key} is not set. Some features may not work properly.`,
        );
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
      warnings,
    };
  }

  getConfigStatus(): {
    supabase: { configured: boolean; url?: string };
    stripe: { configured: boolean };
    gemini: { configured: boolean };
  } {
    return {
      supabase: {
        configured:
          !!this.configService.get<string>('SUPABASE_URL') &&
          !!this.configService.get<string>('SUPABASE_SECRET_KEY'),
        url: this.configService.get<string>('SUPABASE_URL'),
      },
      stripe: {
        configured:
          !!this.configService.get<string>('STRIPE_SECRET_KEY') &&
          !!this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
      },
      gemini: {
        configured: !!this.configService.get<string>('GEMINI_API_KEY'),
      },
    };
  }
}
