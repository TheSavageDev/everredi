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

    // Required environment variables
    const required = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
    ];

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
    firebase: { configured: boolean; projectId?: string };
    stripe: { configured: boolean };
    gemini: { configured: boolean };
  } {
    return {
      firebase: {
        configured:
          !!this.configService.get<string>('FIREBASE_PROJECT_ID') &&
          !!this.configService.get<string>('FIREBASE_PRIVATE_KEY') &&
          !!this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
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
