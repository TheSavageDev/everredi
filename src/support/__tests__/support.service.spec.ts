import { SupportService } from '../support.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { UsersService } from '../../users/users.service';
import { EmailService } from '../../email/email.service';

describe('SupportService', () => {
  let service: SupportService;
  const supabaseMock = createSupabaseClientMock();
  let usersService: jest.Mocked<Partial<UsersService>>;
  const emailService = { isConfigured: jest.fn().mockReturnValue(false) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    usersService = {
      isPremiumUser: jest.fn().mockResolvedValue(false),
    };
    service = new SupportService(
      supabaseMock as any,
      usersService as UsersService,
      emailService,
    );
  });

  describe('createTicket', () => {
    it('creates ticket and returns it', async () => {
      (supabaseMock._setMockData as jest.Mock)('support_tickets', []);

      const result = await service.createTicket('user-1', {
        subject: 'Help',
        message: 'I need help',
        priority: 'normal',
      });

      expect(usersService.isPremiumUser).toHaveBeenCalledWith('user-1');
      expect(result).toBeDefined();
      expect(result.subject).toBe('Help');
      expect(result.userId).toBe('user-1');
    });
  });
});
