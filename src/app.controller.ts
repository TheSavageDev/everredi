import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { EnvValidationService } from './config/env-validation.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly envValidation: EnvValidationService,
  ) {}

  @Get('health')
  @SkipThrottle()
  getHealth() {
    const validation = this.envValidation.validate();
    const configStatus = this.envValidation.getConfigStatus();

    return {
      status: validation.isValid ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'everredi-api',
      environment: process.env.NODE_ENV || 'development',
      config: {
        firebase: configStatus.firebase.configured,
        stripe: configStatus.stripe.configured,
        gemini: configStatus.gemini.configured,
      },
      ...(validation.missing.length > 0 && {
        missingEnvVars: validation.missing,
      }),
      ...(validation.warnings.length > 0 && {
        warnings: validation.warnings,
      }),
    };
  }
}
