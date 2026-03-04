import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';

describe('EmailService', () => {
  let service: EmailService;
  let config: jest.Mocked<Partial<ConfigService>>;

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'RESEND_API_KEY') return undefined;
        if (key === 'EMAIL_FROM') return 'test@test.com';
        if (key === 'SUPPORT_EMAIL_TO') return 'support@test.com';
        return undefined;
      }),
    };
    service = new EmailService(config as ConfigService);
  });

  it('isConfigured returns false when Resend API key not set', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('sendSupportContact does not throw when not configured', async () => {
    await expect(
      service.sendSupportContact('Name', 'email@test.com', 'Message'),
    ).resolves.toBeUndefined();
  });

  it('isConfigured returns true when Resend API key set', () => {
    (config.get as jest.Mock).mockImplementation((key: string) =>
      key === 'RESEND_API_KEY' ? 're_123' : undefined,
    );
    const svc = new EmailService(config as ConfigService);
    expect(svc.isConfigured()).toBe(true);
  });
});
