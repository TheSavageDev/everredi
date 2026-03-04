import { ConfigService } from '@nestjs/config';
import { EnvValidationService } from '../env-validation.service';

describe('EnvValidationService', () => {
  let service: EnvValidationService;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const vals: Record<string, string> = {
          NODE_ENV: 'test',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_SECRET_KEY: 'secret',
        };
        return vals[key] ?? process.env[key];
      }),
    };
    service = new EnvValidationService(configService as ConfigService);
  });

  describe('validate', () => {
    it('returns valid when required vars are set', () => {
      const result = service.validate();

      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns invalid when SUPABASE_URL is missing', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SUPABASE_URL') return undefined;
        if (key === 'SUPABASE_SECRET_KEY') return 'secret';
        return 'test';
      });

      const result = service.validate();

      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('SUPABASE_URL');
    });

    it('adds production-only required vars in production', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'SUPABASE_URL') return 'https://x.supabase.co';
        if (key === 'SUPABASE_SECRET_KEY') return 'secret';
        return undefined;
      });

      const result = service.validate();

      expect(result.isValid).toBe(false);
      expect(result.missing.some((m) => m.includes('STRIPE'))).toBe(true);
    });
  });

  describe('getConfigStatus', () => {
    it('returns configured true when supabase vars set', () => {
      const result = service.getConfigStatus();

      expect(result.supabase.configured).toBe(true);
      expect(result.supabase.url).toBe('https://test.supabase.co');
    });

    it('returns configured false when supabase url missing', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SUPABASE_URL') return undefined;
        if (key === 'SUPABASE_SECRET_KEY') return 'secret';
        return undefined;
      });

      const result = service.getConfigStatus();

      expect(result.supabase.configured).toBe(false);
    });
  });
});
