import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvValidationService } from './config/env-validation.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockEnvValidationService = {
      validate: jest.fn().mockReturnValue({
        isValid: true,
        missing: [],
        warnings: [],
      }),
      getConfigStatus: jest.fn().mockReturnValue({
        supabase: { configured: true, url: 'https://test.supabase.co' },
        stripe: { configured: false },
        gemini: { configured: false },
      }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EnvValidationService,
          useValue: mockEnvValidationService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('config');
    });
  });
});
