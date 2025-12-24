import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EnvValidationService } from './env-validation.service';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      expandVariables: true,
    }),
  ],
  providers: [EnvValidationService],
  exports: [NestConfigModule, EnvValidationService],
})
export class ConfigModule {}
