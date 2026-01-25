import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EnvValidationService } from './env-validation.service';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        '.env.local',
        // Load environment-specific files if NODE_ENV is set, otherwise default to development
        (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) &&
          '.env.development',
        process.env.NODE_ENV === 'production' && '.env.production',
      ].filter((path): path is string => typeof path === 'string'),
      expandVariables: true,
    }),
  ],
  providers: [EnvValidationService],
  exports: [NestConfigModule, EnvValidationService],
})
export class ConfigModule {}
